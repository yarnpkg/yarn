/* @flow */

import http from 'http';
import {SecurityError, MessageError, ResponseError} from '../errors.js';
import type {FetchedOverride} from '../types.js';
import * as constants from '../constants.js';
import * as crypto from '../util/crypto.js';
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

    // handle scoped packages
    const pathParts = pathname.replace(/^\//, '').split(/\//g);

    const packageFilename =
      pathParts.length >= 2 && pathParts[0][0] === '@'
        ? `${pathParts[0]}-${pathParts[pathParts.length - 1]}` // scopped
        : `${pathParts[pathParts.length - 1]}`;

    return this.config.getOfflineMirrorPath(packageFilename);
  }

  createExtractor(
    resolve: (fetched: FetchedOverride) => void,
    reject: (error: Error) => void,
    tarballPath?: string,
  ): {
    validateStream: crypto.HashStream,
    extractorStream: stream.Transform,
  } {
    const validateStream = new crypto.HashStream();
    const extractorStream = gunzip();
    const untarStream = tarFs.extract(this.dest, {
      strip: 1,
      dmode: 0o555, // all dirs should be readable
      fmode: 0o444, // all files should be readable
      chown: false, // don't chown. just leave as it is
    });

    extractorStream
      .pipe(untarStream)
      .on('error', error => {
        error.message = `${error.message}${tarballPath ? ` (${tarballPath})` : ''}`;
        reject(error);
      })
      .on('finish', () => {
        const expectHash = this.hash;
        const actualHash = validateStream.getHash();

        if (!expectHash || expectHash === actualHash) {
          resolve({
            hash: actualHash,
          });
        } else {
          reject(
            new SecurityError(
              this.config.reporter.lang(
                'fetchBadHashWithPath',
                this.packageName,
                this.remote.reference,
                expectHash,
                actualHash,
              ),
            ),
          );
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
              Accept: 'application/octet-stream',
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
}

export class LocalTarballFetcher extends TarballFetcher {
  _fetch(): Promise<FetchedOverride> {
    return this.fetchFromLocal(this.reference);
  }
}
