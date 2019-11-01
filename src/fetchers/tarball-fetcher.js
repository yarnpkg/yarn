/* @flow */

import {SecurityError, MessageError} from '../errors.js';
import type {FetchedOverride} from '../types.js';
import * as constants from '../constants.js';
import BaseFetcher from './base-fetcher.js';
import * as fsUtil from '../util/fs.js';
import {removePrefix} from '../util/misc.js';
import normalizeUrl from 'normalize-url';

const crypto = require('crypto');
const path = require('path');
const tarFs = require('tar-fs');
const url = require('url');
const fs = require('fs');
const gunzip = require('gunzip-maybe');
const invariant = require('invariant');
const ssri = require('ssri');

const RE_URL_NAME_MATCH = /\/(?:(@[^/]+)(?:\/|%2f))?[^/]+\/(?:-|_attachments)\/(?:@[^/]+\/)?([^/]+)$/;

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

  async extract(stream: Object, tarballPath?: string, size?: number, pipeTar?: Object[]): Promise<FetchedOverride> {
    const hashInfo = this._supportedIntegrity({hashOnly: true});
    const integrityInfo = this._supportedIntegrity({hashOnly: false});

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

    // stream ->
    //   hashValidateStream ->
    //     integrityValidateStream ->
    //       extractorStream ->
    //         tar file
    //       ...pipeTar

    const hashValidateStream = new ssri.integrityStream({...hashInfo, size});
    const integrityValidateStream = new ssri.integrityStream(integrityInfo);

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

    // Keep track of streams, so that we can wait until either all of them have finished, or one of then has failed.
    const streamPromises = [];

    let hashError: ?Object = null;
    let integrityError: ?Object = null;
    let validateIntegrity: ?Object = null;

    // These two may emit _both_ 'finish' and 'error', so we don't turn them into Promises.
    // No need to explicitly wait for the finish event on these.
    hashValidateStream.once('error', error => {
      hashError = error;
    });

    integrityValidateStream.once('error', error => {
      integrityError = error;
    });

    integrityValidateStream.once('integrity', sri => {
      validateIntegrity = sri;
    });

    stream.pipe(hashValidateStream);
    hashValidateStream.pipe(integrityValidateStream);
    integrityValidateStream.pipe(extractorStream);
    if (pipeTar) {
      for (const out of pipeTar) {
        streamPromises.push(streamToPromise(integrityValidateStream.pipe(out)));
      }
    }

    streamPromises.push(
      streamToPromise(extractorStream).catch(error => {
        if (tarballPath) {
          throw new MessageError(this.config.reporter.lang('fetchErrorCorrupt', error.message, tarballPath));
        } else {
          throw error;
        }
      }),
    );

    streamPromises.push(
      streamToPromise(extractorStream.pipe(untarStream)).catch(error => {
        if (tarballPath) {
          throw new MessageError(this.config.reporter.lang('errorExtractingTarball', error.message, tarballPath));
        } else {
          throw error;
        }
      }),
    );

    try {
      await Promise.all(streamPromises);
    } catch (err) {
      if (hashError && hashError.code == 'EBADSIZE') {
        // Report Content-Length mismatch, rather than extract errors.
        const retryableError: Object = new MessageError(
          this.reporter.lang('requestFailed', this.reference + ': ' + hashError.message),
        );
        retryableError.retry = true;
        throw retryableError;
      }
      throw err;
    }

    const hexDigest = validateIntegrity ? validateIntegrity.hexDigest() : '';
    if (
      this.config.updateChecksums &&
      this.remote.integrity &&
      validateIntegrity &&
      this.remote.integrity !== validateIntegrity.toString()
    ) {
      this.remote.integrity = validateIntegrity.toString();
    } else if (validateIntegrity) {
      this.remote.cacheIntegrity = validateIntegrity.toString();
    }

    if (integrityInfo.integrity && Object.keys(integrityInfo.integrity).length === 0) {
      throw new SecurityError(
        this.config.reporter.lang('fetchBadIntegrityAlgorithm', this.packageName, this.remote.reference),
      );
    }

    const error = integrityError || hashError;
    if (error && error.code == 'EINTEGRITY') {
      if (this.config.updateChecksums) {
        this.remote.integrity = error.found.toString();
      } else {
        throw new SecurityError(
          this.config.reporter.lang(
            'fetchBadHashWithPath',
            this.packageName,
            this.remote.reference,
            error.found.toString(),
            error.expected.toString(),
          ),
        );
      }
    } else if (error) {
      throw error;
    }

    return {hash: this.hash || hexDigest};
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

    if (!stream) {
      throw new MessageError(this.reporter.lang('tarballNotInNetworkOrCache', this.reference, tarPaths));
    }
    invariant(stream, 'stream should be available at this point');
    // $FlowFixMe - This is available https://nodejs.org/api/fs.html#fs_readstream_path
    const tarballPath = stream.path;
    return this.extract(stream, tarballPath);
  }

  async fetchFromExternal(): Promise<FetchedOverride> {
    const registry = this.config.registries[this.registry];

    try {
      const headers = this.requestHeaders();
      return await registry.request(
        this.reference,
        {
          headers: {
            'Accept-Encoding': 'gzip',
            ...headers,
          },
          buffer: true,
          process: async (req, res) => {
            // Content-Length header is optional in the response.
            // If it is present, we validate the body length against it.
            const contentLength = parseInt(res.headers['content-length'], 10) || undefined;

            // should we save this to the offline cache?
            const tarballMirrorPath = this.getTarballMirrorPath();
            const tarballCachePath = this.getTarballCachePath();

            const tarballStreams = [];
            if (tarballMirrorPath) {
              tarballStreams.push(fs.createWriteStream(tarballMirrorPath));
            }
            if (tarballCachePath) {
              tarballStreams.push(fs.createWriteStream(tarballCachePath));
            }

            try {
              return await this.extract(req, undefined, contentLength, tarballStreams);
            } catch (error) {
              await this.removeDownloadedFiles();
              throw error;
            }
          },
        },
        this.packageName,
      );
    } catch (err) {
      await this.removeDownloadedFiles();
      throw err;
    }
  }

  async removeDownloadedFiles(): Promise<void> {
    // fsUtil.unlink takes care of recursively removing a folder if it exists
    const tarballMirrorPath = this.getTarballMirrorPath();
    const tarballCachePath = this.getTarballCachePath();
    if (tarballMirrorPath) {
      await fsUtil.unlink(tarballMirrorPath);
    }
    if (tarballCachePath) {
      await fsUtil.unlink(tarballCachePath);
    }
  }

  requestHeaders(): {[string]: string} {
    const registry = this.config.registries.yarn;
    const config = registry.config;
    const requestParts = urlParts(this.reference);
    return Object.keys(config).reduce((headers, option) => {
      const parts = option.split(':');
      if (parts.length === 3 && parts[1] === '_header') {
        const registryParts = urlParts(parts[0]);
        if (requestParts.host === registryParts.host && requestParts.path.startsWith(registryParts.path)) {
          const headerName = parts[2];
          const headerValue = config[option];
          headers[headerName] = headerValue;
        }
      }
      return headers;
    }, {});
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

  _findIntegrity({hashOnly}: {hashOnly: boolean}): ?Object {
    if (this.remote.integrity && !hashOnly) {
      return ssri.parse(this.remote.integrity);
    }
    if (this.hash) {
      return ssri.fromHex(this.hash, 'sha1');
    }
    return null;
  }

  _supportedIntegrity({hashOnly}: {hashOnly: boolean}): {integrity: ?Object, algorithms: Array<string>} {
    const expectedIntegrity = this._findIntegrity({hashOnly}) || {};
    const expectedIntegrityAlgorithms = Object.keys(expectedIntegrity);
    const shouldValidateIntegrity = (this.hash || this.remote.integrity) && !this.config.updateChecksums;

    if (expectedIntegrityAlgorithms.length === 0 && (!shouldValidateIntegrity || hashOnly)) {
      const algorithms = this.config.updateChecksums ? ['sha512'] : ['sha1'];
      // for consistency, return sha1 for packages without a remote integrity (eg. github)
      return {integrity: null, algorithms};
    }

    const algorithms = new Set(['sha512', 'sha1']);
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

type UrlParts = {
  host: string,
  path: string,
};

function urlParts(requestUrl: string): UrlParts {
  const normalizedUrl = normalizeUrl(requestUrl);
  const parsed = url.parse(normalizedUrl);
  const host = parsed.host || '';
  const path = parsed.path || '';
  return {host, path};
}

function streamToPromise(stream: Object): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('finish', resolve);
  });
}
