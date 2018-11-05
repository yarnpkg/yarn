/* @flow */

import {SecurityError, MessageError} from '../errors.js';
import type {FetchedOverride} from '../types.js';
import * as constants from '../constants.js';
import BaseFetcher from './base-fetcher.js';
import * as fsUtil from '../util/fs.js';
import {removePrefix} from '../util/misc.js';

const crypto = require('crypto');
const path = require('path');
const tarFs = require('tar-fs');
const url = require('url');
const fs = require('fs');
const stream = require('stream');
const gunzip = require('gunzip-maybe');
const invariant = require('invariant');
const ssri = require('ssri');

const RE_URL_NAME_MATCH = /\/(?:(@[^/]+)\/)?[^/]+\/-\/(?:@[^/]+\/)?([^/]+)$/;

const isHashAlgorithmSupported = name => {
  const cachedResult = isHashAlgorithmSupported.__cache[name];
  if (cachedResult != null) {
    return cachedResult;
  }
  let supported = true;
  try {
    crypto.createHash(name);
  } catch (error) {
    if (error.message !== 'Digest method not supported') {
      throw error;
    }
    supported = false;
  }

  isHashAlgorithmSupported.__cache[name] = supported;
  return supported;
};
isHashAlgorithmSupported.__cache = {};

export default class TarballFetcher extends BaseFetcher {
  validateError: ?Object = null;
  validateIntegrity: ?Object = null;
  async setupMirrorFromCache(): Promise<?string> {
    const tarballMirrorPath = this.getTarballMirrorPath();
    const tarballCachePath = this.getTarballCachePath();

    if (tarballMirrorPath == null) {
      return;
    }

    if (!await fsUtil.exists(tarballMirrorPath) && (await fsUtil.exists(tarballCachePath))) {
      // The tarball doesn't exists in the offline cache but does in the cache; we import it to the mirror
      await fsUtil.mkdirp(path.dirname(tarballMirrorPath));
      await fsUtil.copy(tarballCachePath, tarballMirrorPath, this.reporter);
    }
  }

  getTarballCachePath(): string {
    return path.join(this.dest, constants.TARBALL_FILENAME);
  }

  getTarballMirrorPath(): ?string {
    const {pathname} = url.parse(this.reference);

    if (pathname == null) {
      return null;
    }

    const match = pathname.match(RE_URL_NAME_MATCH);

    let packageFilename;
    if (match) {
      const [, scope, tarballBasename] = match;
      packageFilename = scope ? `${scope}-${tarballBasename}` : tarballBasename;
    } else {
      // fallback to base name
      packageFilename = path.basename(pathname);
    }

    return this.config.getOfflineMirrorPath(packageFilename);
  }

  createExtractor(
    resolve: (fetched: FetchedOverride) => void,
    reject: (error: Error) => void,
    tarballPath?: string,
  ): {
    validateStream: ssri.integrityStream,
    extractorStream: stream.Transform,
  } {
    const integrityInfo = this._supportedIntegrity();

    const now = new Date();

    const fs = require('fs');
    const patchedFs = Object.assign({}, fs, {
      utimes: (path, atime, mtime, cb) => {
        fs.stat(path, (err, stat) => {
          if (err) {
            cb(err);
            return;
          }
          if (stat.isDirectory()) {
            fs.utimes(path, atime, mtime, cb);
            return;
          }
          fs.open(path, 'a', (err, fd) => {
            if (err) {
              cb(err);
              return;
            }
            fs.futimes(fd, atime, mtime, err => {
              if (err) {
                fs.close(fd, () => cb(err));
              } else {
                fs.close(fd, err => cb(err));
              }
            });
          });
        });
      },
    });

    const validateStream = new ssri.integrityStream(integrityInfo);
    const untarStream = tarFs.extract(this.dest, {
      strip: 1,
      dmode: 0o755, // all dirs should be readable
      fmode: 0o644, // all files should be readable
      chown: false, // don't chown. just leave as it is
      map: header => {
        header.mtime = now;
        return header;
      },
      fs: patchedFs,
    });
    const extractorStream = gunzip();

    validateStream.once('error', err => {
      this.validateError = err;
    });
    validateStream.once('integrity', sri => {
      this.validateIntegrity = sri;
    });

    untarStream.on('error', err => {
      reject(new MessageError(this.config.reporter.lang('errorExtractingTarball', err.message, tarballPath)));
    });

    extractorStream.pipe(untarStream).on('finish', () => {
      const error = this.validateError;
      const hexDigest = this.validateIntegrity ? this.validateIntegrity.hexDigest() : '';
      if (
        this.config.updateChecksums &&
        this.remote.integrity &&
        this.validateIntegrity &&
        this.remote.integrity !== this.validateIntegrity.toString()
      ) {
        this.remote.integrity = this.validateIntegrity.toString();
      }

      if (integrityInfo.algorithms.length === 0) {
        return reject(
          new SecurityError(
            this.config.reporter.lang('fetchBadIntegrityAlgorithm', this.packageName, this.remote.reference),
          ),
        );
      }

      if (error) {
        if (this.config.updateChecksums) {
          this.remote.integrity = error.found.toString();
        } else {
          return reject(
            new SecurityError(
              this.config.reporter.lang(
                'fetchBadHashWithPath',
                this.packageName,
                this.remote.reference,
                error.found.toString(),
                error.expected.toString(),
              ),
            ),
          );
        }
      }

      return resolve({
        hash: this.hash || hexDigest,
      });
    });

    return {validateStream, extractorStream};
  }

  getLocalPaths(override: ?string): Array<string> {
    const paths: Array<?string> = [
      override ? path.resolve(this.config.cwd, override) : null,
      this.getTarballMirrorPath(),
      this.getTarballCachePath(),
    ];
    // $FlowFixMe: https://github.com/facebook/flow/issues/1414
    return paths.filter(path => path != null);
  }

  async fetchFromLocal(override: ?string): Promise<FetchedOverride> {
    const tarPaths = this.getLocalPaths(override);
    const stream = await fsUtil.readFirstAvailableStream(tarPaths);

    return new Promise((resolve, reject) => {
      if (!stream) {
        reject(new MessageError(this.reporter.lang('tarballNotInNetworkOrCache', this.reference, tarPaths)));
        return;
      }
      invariant(stream, 'stream should be available at this point');
      // $FlowFixMe - This is available https://nodejs.org/api/fs.html#fs_readstream_path
      const tarballPath = stream.path;
      const {validateStream, extractorStream} = this.createExtractor(resolve, reject, tarballPath);

      stream.pipe(validateStream).pipe(extractorStream).on('error', err => {
        reject(new MessageError(this.config.reporter.lang('fetchErrorCorrupt', err.message, tarballPath)));
      });
    });
  }

  async fetchFromExternal(): Promise<FetchedOverride> {
    const registry = this.config.registries[this.registry];

    try {
      return await registry.request(
        this.reference,
        {
          headers: {
            'Accept-Encoding': 'gzip',
          },
          buffer: true,
          process: (req, resolve, reject) => {
            // should we save this to the offline cache?
            const tarballMirrorPath = this.getTarballMirrorPath();
            const tarballCachePath = this.getTarballCachePath();

            const {validateStream, extractorStream} = this.createExtractor(resolve, reject);

            req.pipe(validateStream);

            if (tarballMirrorPath) {
              validateStream.pipe(fs.createWriteStream(tarballMirrorPath)).on('error', reject);
            }

            if (tarballCachePath) {
              validateStream.pipe(fs.createWriteStream(tarballCachePath)).on('error', reject);
            }

            validateStream.pipe(extractorStream).on('error', reject);
          },
        },
        this.packageName,
      );
    } catch (err) {
      const tarballMirrorPath = this.getTarballMirrorPath();
      const tarballCachePath = this.getTarballCachePath();

      if (tarballMirrorPath && (await fsUtil.exists(tarballMirrorPath))) {
        await fsUtil.unlink(tarballMirrorPath);
      }

      if (tarballCachePath && (await fsUtil.exists(tarballCachePath))) {
        await fsUtil.unlink(tarballCachePath);
      }

      throw err;
    }
  }

  _fetch(): Promise<FetchedOverride> {
    const isFilePath = this.reference.startsWith('file:');
    this.reference = removePrefix(this.reference, 'file:');
    const urlParse = url.parse(this.reference);

    // legacy support for local paths in yarn.lock entries
    const isRelativePath = urlParse.protocol
      ? urlParse.protocol.match(/^[a-z]:$/i)
      : urlParse.pathname ? urlParse.pathname.match(/^(?:\.{1,2})?[\\\/]/) : false;

    if (isFilePath || isRelativePath) {
      return this.fetchFromLocal(this.reference);
    }

    return this.fetchFromLocal().catch(err => this.fetchFromExternal());
  }

  _findIntegrity(): ?Object {
    if (this.remote.integrity) {
      return ssri.parse(this.remote.integrity);
    }
    if (this.hash) {
      return ssri.fromHex(this.hash, 'sha1');
    }
    return null;
  }

  _supportedIntegrity(): {integrity: ?Object, algorithms: Array<string>} {
    const expectedIntegrity = this._findIntegrity() || {};
    const expectedIntegrityAlgorithms = Object.keys(expectedIntegrity);
    const shouldValidateIntegrity = (this.hash || this.remote.integrity) && !this.config.updateChecksums;

    if (expectedIntegrityAlgorithms.length === 0 && !shouldValidateIntegrity) {
      const algorithms = this.config.updateChecksums ? ['sha512'] : ['sha1'];
      // for consistency, return sha1 for packages without a remote integrity (eg. github)
      return {integrity: null, algorithms};
    }

    const algorithms = new Set();
    const integrity = {};
    for (const algorithm of expectedIntegrityAlgorithms) {
      if (isHashAlgorithmSupported(algorithm)) {
        algorithms.add(algorithm);
        integrity[algorithm] = expectedIntegrity[algorithm];
      }
    }

    return {integrity, algorithms: Array.from(algorithms)};
  }
}

export class LocalTarballFetcher extends TarballFetcher {
  _fetch(): Promise<FetchedOverride> {
    return this.fetchFromLocal(this.reference);
  }
}
