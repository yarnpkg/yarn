/* @flow */

import http from 'http';
import {SecurityError, MessageError} from '../errors.js';
import type {FetchedOverride} from '../types.js';
import {UnpackStream} from '../util/stream.js';
import * as constants from '../constants.js';
import * as crypto from '../util/crypto.js';
import BaseFetcher from './base-fetcher.js';
import * as fsUtil from '../util/fs.js';

const invariant = require('invariant');
const path = require('path');
const tarFs = require('tar-fs');
const url = require('url');
const fs = require('fs');

export default class TarballFetcher extends BaseFetcher {
  async getResolvedFromCached(hash: string): Promise<?string> {
    const mirrorPath = this.getMirrorPath();
    if (mirrorPath == null) {
      // no mirror
      return null;
    }

    const tarballLoc = path.join(this.dest, constants.TARBALL_FILENAME);
    if (!(await fsUtil.exists(tarballLoc))) {
      // no tarball located in the cache
      return null;
    }

    // copy the file over
    if (!await fsUtil.exists(mirrorPath)) {
      await fsUtil.copy(tarballLoc, mirrorPath, this.reporter);
    }

    const relativeMirrorPath = this.getRelativeMirrorPath(mirrorPath);
    invariant(relativeMirrorPath != null, 'Missing offline mirror path');

    return `${relativeMirrorPath}#${hash}`;
  }

  getMirrorPath(): ?string {
    const {pathname} = url.parse(this.reference);

    if (pathname == null) {
      return this.config.getOfflineMirrorPath();
    }

    let packageFilename = path.basename(pathname);

    // handle scoped packages
    const pathParts = pathname.slice(1).split('/');
    if (pathParts[0][0] === '@') {
      // scoped npm package
      packageFilename = `${pathParts[0]}-${packageFilename}`;
    }

    return this.config.getOfflineMirrorPath(packageFilename);
  }

  getRelativeMirrorPath(mirrorPath: string): ?string {
    const offlineMirrorPath = this.config.getOfflineMirrorPath();
    if (offlineMirrorPath == null) {
      return null;
    }
    return path.relative(offlineMirrorPath, mirrorPath);
  }

  createExtractor(
    mirrorPath: ?string,
    resolve: (fetched: FetchedOverride) => void,
    reject: (error: Error) => void,
  ): {
    validateStream: crypto.HashStream,
    extractorStream: UnpackStream,
  } {
    const validateStream = new crypto.HashStream();
    const extractorStream = new UnpackStream();
    const untarStream = tarFs.extract(this.dest, {
      strip: 1,
      dmode: 0o555, // all dirs should be readable
      fmode: 0o444, // all files should be readable
    });

    extractorStream
      .pipe(untarStream)
      .on('error', reject)
      .on('entry', (entry: Object) => {
        if (constants.ROOT_USER) {
          entry.props.uid = entry.uid = 0;
          entry.props.gid = entry.gid = 0;
        }
      })
      .on('finish', () => {
        const expectHash = this.hash;
        const actualHash = validateStream.getHash();
        if (!expectHash || expectHash === actualHash) {
          resolve({
            hash: actualHash,
            resolved: mirrorPath ? `${mirrorPath}#${actualHash}` : null,
          });
        } else {
          reject(new SecurityError(
            this.config.reporter.lang('fetchBadHash', expectHash, actualHash),
          ));
        }
      });

    return {validateStream, extractorStream};
  }

  async fetchFromLocal(pathname: ?string): Promise<FetchedOverride> {
    const {reference: ref, config} = this;
    const {reporter} = config;

    // path to the local tarball
    let localTarball;
    let isOfflineTarball = false;

    const relativeFileLoc = pathname ? path.join(config.cwd, pathname) : null;
    if (relativeFileLoc && await fsUtil.exists(relativeFileLoc)) {
      // this is a reference to a file relative to the cwd
      localTarball = relativeFileLoc;
    } else {
      // generate a offline cache location
      const offlineMirrorPath = config.getOfflineMirrorPath() || '';
      localTarball = path.resolve(offlineMirrorPath, ref);
      isOfflineTarball = true;
    }

    if (!(await fsUtil.exists(localTarball))) {
      throw new MessageError(reporter.lang('tarballNotInNetworkOrCache', ref, localTarball));
    }

    return new Promise((resolve, reject) => {
      const {validateStream, extractorStream} = this.createExtractor(null, resolve, reject);

      const cachedStream = fs.createReadStream(localTarball);

      cachedStream
        .pipe(validateStream)
        .pipe(extractorStream)
        .on('error', function(err) {
          let msg = 'errorDecompressingTarball';
          if (isOfflineTarball) {
            msg = 'fetchErrorCorrupt';
          }
          reject(new MessageError(reporter.lang(msg, err.message, localTarball)));
        });
    });
  }

  fetchFromExternal(): Promise<FetchedOverride> {
    const {reference: ref} = this;
    const registry = this.config.registries[this.registry];

    return registry.request(ref, {
      headers: {
        'Accept-Encoding': 'gzip',
        'Accept': 'application/octet-stream',
      },
      buffer: true,
      process: (req, resolve, reject) => {
        const {reporter} = this.config;
        // should we save this to the offline cache?
        const mirrorPath = this.getMirrorPath();
        const tarballStorePath = path.join(this.dest, constants.TARBALL_FILENAME);
        const overwriteResolved = mirrorPath
          ? this.getRelativeMirrorPath(mirrorPath)
          : null;

        //
        const {
          validateStream,
          extractorStream,
        } = this.createExtractor(overwriteResolved, resolve, reject);

        const handleRequestError = (res) => {
          if (res.statusCode >= 400) {
            // $FlowFixMe
            const statusDescription = http.STATUS_CODES[res.statusCode];
            reject(new Error(
              reporter.lang('requestFailed', `${res.statusCode} ${statusDescription}`),
            ));
          }
        };

        req.on('response', handleRequestError);
        req.pipe(validateStream);

        validateStream
          .pipe(fs.createWriteStream(tarballStorePath))
          .on('error', reject);

        validateStream
          .pipe(extractorStream)
          .on('error', reject);
        if (mirrorPath) {
          validateStream
            .pipe(fs.createWriteStream(mirrorPath))
            .on('error', reject);
        }
      },
    });
  }

  _fetch(): Promise<FetchedOverride> {
    const {protocol, pathname} = url.parse(this.reference);
    if (protocol === null && typeof pathname === 'string') {
      return this.fetchFromLocal(pathname);
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
