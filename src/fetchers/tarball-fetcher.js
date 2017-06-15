/* @flow */

import http from 'http';
import {SecurityError, MessageError} from '../errors.js';
import type {FetchedOverride} from '../types.js';
import * as constants from '../constants.js';
import * as crypto from '../util/crypto.js';
import BaseFetcher from './base-fetcher.js';
import * as fsUtil from '../util/fs.js';

const path = require('path');
const tarFs = require('tar-fs');
const url = require('url');
const fs = require('fs');
const stream = require('stream');
const gunzip = require('gunzip-maybe');

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

  async getLocalAvailabilityStatus(): Promise<boolean> {
    const tarballMirrorPath = this.getTarballMirrorPath();
    const tarballCachePath = this.getTarballCachePath();

    if (tarballMirrorPath != null && (await fsUtil.exists(tarballMirrorPath))) {
      return true;
    }

    if (await fsUtil.exists(tarballCachePath)) {
      return true;
    }

    return false;
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

    const packageFilename = pathParts.length >= 2 && pathParts[0][0] === '@'
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
              this.config.reporter.lang('fetchBadHashWithPath', this.remote.reference, expectHash, actualHash),
            ),
          );
        }
      });

    return {validateStream, extractorStream};
  }

  async fetchFromLocal(override: ?string): Promise<FetchedOverride> {
    const tarballMirrorPath = this.getTarballMirrorPath();
    const tarballCachePath = this.getTarballCachePath();

    const tarballPath = path.resolve(this.config.cwd, override || tarballMirrorPath || tarballCachePath);

    if (!tarballPath || !await fsUtil.exists(tarballPath)) {
      throw new MessageError(this.config.reporter.lang('tarballNotInNetworkOrCache', this.reference, tarballPath));
    }

    return new Promise((resolve, reject) => {
      const {validateStream, extractorStream} = this.createExtractor(resolve, reject, tarballPath);
      const cachedStream = fs.createReadStream(tarballPath);

      cachedStream.pipe(validateStream).pipe(extractorStream).on('error', err => {
        reject(new MessageError(this.config.reporter.lang('fetchErrorCorrupt', err.message, tarballPath)));
      });
    });
  }

  fetchFromExternal(): Promise<FetchedOverride> {
    const registry = this.config.registries[this.registry];

    return registry.request(
      this.reference,
      {
        headers: {
          'Accept-Encoding': 'gzip',
          Accept: 'application/octet-stream',
        },
        buffer: true,
        process: (req, resolve, reject) => {
          const {reporter} = this.config;
          // should we save this to the offline cache?
          const tarballMirrorPath = this.getTarballMirrorPath();
          const tarballCachePath = this.getTarballCachePath();

          const {validateStream, extractorStream} = this.createExtractor(resolve, reject);

          const handleRequestError = res => {
            if (res.statusCode >= 400) {
              const statusDescription = http.STATUS_CODES[res.statusCode];
              reject(new Error(reporter.lang('requestFailed', `${res.statusCode} ${statusDescription}`)));
            }
          };

          req.on('response', handleRequestError);
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
  }

  async _fetch(): Promise<FetchedOverride> {
    const urlParse = url.parse(this.reference);

    const isFilePath = urlParse.protocol
      ? urlParse.protocol.match(/^[a-z]:$/i)
      : urlParse.pathname ? urlParse.pathname.match(/^(?:\.{1,2})?[\\\/]/) : false;

    if (isFilePath) {
      return this.fetchFromLocal(this.reference);
    }

    if (await this.getLocalAvailabilityStatus()) {
      return this.fetchFromLocal();
    } else {
      return this.fetchFromExternal();
    }
  }
}

export class LocalTarballFetcher extends TarballFetcher {
  _fetch(): Promise<FetchedOverride> {
    return this.fetchFromLocal(this.reference);
  }
}
