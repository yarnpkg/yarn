/* @flow */

import http from 'http';
import {SecurityError, MessageError, ResponseError} from '../errors.js';
import type {FetchedOverride} from '../types.js';
import * as constants from '../constants.js';
import BaseFetcher from './base-fetcher.js';
import * as fsUtil from '../util/fs.js';
import {removePrefix, sleep} from '../util/misc.js';

const path = require('path');
const tarFs = require('tar-fs');
const url = require('url');
const fs = require('fs');
const stream = require('stream');
const gunzip = require('gunzip-maybe');
const invariant = require('invariant');
const ssri = require('ssri');

const RE_URL_NAME_MATCH = /\/(?:(@[^/]+)\/)?[^/]+\/-\/(?:@[^/]+\/)?([^/]+)$/;

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
    let supportedIntegrity;
    try {
      supportedIntegrity = this._supportedIntegrity();
    } catch (e) {
      if (this.config.updateChecksums) {
        // it's okay that we do not have any supported integrity, because we need to update it!
        supportedIntegrity = {integrity: null, algorithms: ['sha1']};
      } else {
        reject(
          new SecurityError(
            this.config.reporter.lang('fetchBadIntegrityAlgorithm', this.packageName, this.remote.reference),
          ),
        );
        return {validateStream: ssri.integrityStream(), extractorStream: gunzip()};
      }
    }
    const {integrity, algorithms} = supportedIntegrity;
    const validateStream = new ssri.integrityStream({integrity, algorithms});
    const extractorStream = gunzip();
    const untarStream = tarFs.extract(this.dest, {
      strip: 1,
      dmode: 0o755, // all dirs should be readable
      fmode: 0o644, // all files should be readable
      chown: false, // don't chown. just leave as it is
    });
    validateStream.once('error', err => {
      this.validateError = err;
    });
    validateStream.once('integrity', sri => {
      this.validateIntegrity = sri;
    });
    extractorStream
      .pipe(untarStream)
      .on('error', error => {
        error.message = `${error.message}${tarballPath ? ` (${tarballPath})` : ''}`;
        reject(error);
      })
      .on('finish', () => {
        if (this.validateError) {
          this._handleValidationError(resolve, reject);
        } else {
          const hexDigest = this.validateIntegrity ? this.validateIntegrity.hexDigest() : '';
          resolve({
            hash: this.hash || hexDigest,
          });
        }
      });
    return {validateStream, extractorStream};
  }

  *getLocalPaths(override: ?string): Generator<?string, void, void> {
    if (override) {
      yield path.resolve(this.config.cwd, override);
    }
    yield this.getTarballMirrorPath();
    yield this.getTarballCachePath();
  }

  async fetchFromLocal(override: ?string): Promise<FetchedOverride> {
    const {stream, triedPaths} = await fsUtil.readFirstAvailableStream(this.getLocalPaths(override));

    return new Promise((resolve, reject) => {
      if (!stream) {
        reject(new MessageError(this.reporter.lang('tarballNotInNetworkOrCache', this.reference, triedPaths)));
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

    let retriesRemaining = 2;
    do {
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
              const {reporter} = this.config;
              const tarballMirrorPath = this.getTarballMirrorPath();
              const tarballCachePath = this.getTarballCachePath();

              const {validateStream, extractorStream} = this.createExtractor(resolve, reject);

              req.on('response', res => {
                if (res.statusCode >= 400) {
                  const statusDescription = http.STATUS_CODES[res.statusCode];
                  reject(
                    new ResponseError(
                      reporter.lang('requestFailed', `${res.statusCode} ${statusDescription}`),
                      res.statusCode,
                    ),
                  );
                }
              });
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
        if (err instanceof ResponseError && err.responseCode >= 500 && retriesRemaining > 1) {
          retriesRemaining--;
          this.reporter.warn(this.reporter.lang('retryOnInternalServerError'));
          await sleep(3000);
        } else {
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
    } while (retriesRemaining > 0);
    // Unreachable code, this is just to make Flow happy
    throw new Error('Ran out of retries!');
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

  _handleValidationError(resolve: Function, reject: Function) {
    if (this.config.updateChecksums && this.validateError && this.validateError.found) {
      // integrity differs and should be updated
      this.remote.integrity = this.validateError.found.toString();
      resolve({
        hash: this.hash || '',
      });
    } else {
      const expected =
        this.validateError && this.validateError.expected
          ? this.validateError.expected.toString()
          : this.remote.integrity ? this.remote.integrity.toString() : this.hash;
      const found = this.validateError ? this.validateError.found : ssri.create();
      reject(
        new SecurityError(
          this.config.reporter.lang(
            'fetchBadHashWithPath',
            this.packageName,
            this.remote.reference,
            found.toString(),
            expected,
          ),
        ),
      );
    }
  }

  _findIntegrity(): ?Object {
    if (this.remote.integrity) {
      return this.remote.integrity;
    }
    if (this.hash) {
      return ssri.fromHex(this.hash, 'sha1');
    }
    return null;
  }

  _supportedIntegrity(): {integrity: ?Object, algorithms: Array<string>} {
    const supportedAlgorithms = constants.INTEGRITY_ALGORITHMS;
    const wantedIntegrity = this._findIntegrity();
    if (!wantedIntegrity || Object.keys(wantedIntegrity).length === 0) {
      // nothing to compare against, we should provide an empty integrity object
      return {integrity: wantedIntegrity, algorithms: ['sha1']};
    }
    const {integrity, algorithms} = Object.keys(wantedIntegrity).reduce(
      (acc, algorithm) => {
        if (supportedAlgorithms.indexOf(algorithm) > -1) {
          acc.integrity[algorithm] = wantedIntegrity[algorithm];
          acc.algorithms.push(algorithm);
        }
        return acc;
      },
      {integrity: {}, algorithms: []},
    );
    if (algorithms.length === 0) {
      throw new Error('no supported algorithms');
    }
    return {integrity, algorithms};
  }
}

export class LocalTarballFetcher extends TarballFetcher {
  _fetch(): Promise<FetchedOverride> {
    return this.fetchFromLocal(this.reference);
  }
}
