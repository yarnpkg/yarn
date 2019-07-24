/* @flow */

import {SecurityError, MessageError} from '../errors.js';
import type {FetchedOverride} from '../types.js';
import BaseFetcher from './base-fetcher.js';
import Git from '../util/git.js';
import * as fsUtil from '../util/fs.js';
import * as constants from '../constants.js';
import * as crypto from '../util/crypto.js';
import {install} from '../cli/commands/install.js';
import Lockfile from '../lockfile';
import Config from '../config.js';
import {packTarball} from '../cli/commands/pack.js';

const tarFs = require('tar-fs');
const url = require('url');
const path = require('path');
const fs = require('fs');

const invariant = require('invariant');

const PACKED_FLAG = '1';

export default class GitFetcher extends BaseFetcher {
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

  getTarballMirrorPath({withCommit = true}: {withCommit: boolean} = {}): ?string {
    const {pathname} = url.parse(this.reference);

    if (pathname == null) {
      return null;
    }

    const hash = this.hash;

    let packageFilename = withCommit && hash ? `${path.basename(pathname)}-${hash}` : `${path.basename(pathname)}`;

    if (packageFilename.startsWith(':')) {
      packageFilename = packageFilename.substr(1);
    }

    return this.config.getOfflineMirrorPath(packageFilename);
  }

  getTarballCachePath(): string {
    return path.join(this.dest, constants.TARBALL_FILENAME);
  }

  getLocalPaths(override: ?string): Array<string> {
    const paths: Array<?string> = [
      override ? path.resolve(this.config.cwd, override) : null,
      this.getTarballMirrorPath(),
      this.getTarballMirrorPath({withCommit: false}),
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
      invariant(stream, 'cachedStream should be available at this point');
      // $FlowFixMe - This is available https://nodejs.org/api/fs.html#fs_readstream_path
      const tarballPath = stream.path;

      const untarStream = this._createUntarStream(this.dest);

      const hashStream = new crypto.HashStream();
      stream
        .pipe(hashStream)
        .pipe(untarStream)
        .on('finish', () => {
          const expectHash = this.hash;
          invariant(expectHash, 'Commit hash required');

          const actualHash = hashStream.getHash();

          // This condition is disabled because "expectHash" actually is the commit hash
          // This is a design issue that we'll need to fix (https://github.com/yarnpkg/yarn/pull/3449)
          if (true || !expectHash || expectHash === actualHash) {
            resolve({
              hash: expectHash,
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
        })
        .on('error', function(err) {
          reject(new MessageError(this.reporter.lang('fetchErrorCorrupt', err.message, tarballPath)));
        });
    });
  }

  async hasPrepareScript(git: Git): Promise<boolean> {
    const manifestFile = await git.getFile('package.json');

    if (manifestFile) {
      const scripts = JSON.parse(manifestFile).scripts;
      const hasPrepareScript = Boolean(scripts && scripts.prepare);
      return hasPrepareScript;
    }

    return false;
  }

  async fetchFromExternal(): Promise<FetchedOverride> {
    const hash = this.hash;
    invariant(hash, 'Commit hash required');

    const gitUrl = Git.npmUrlToGitUrl(this.reference);
    const git = new Git(this.config, gitUrl, hash);
    await git.init();

    if (await this.hasPrepareScript(git)) {
      await this.fetchFromInstallAndPack(git);
    } else {
      await this.fetchFromGitArchive(git);
    }

    return {
      hash,
    };
  }

  async fetchFromInstallAndPack(git: Git): Promise<void> {
    const prepareDirectory = this.config.getTemp(`${crypto.hash(git.gitUrl.repository)}.${git.hash}.prepare`);
    await fsUtil.unlink(prepareDirectory);

    await git.clone(prepareDirectory);

    const [prepareConfig, prepareLockFile] = await Promise.all([
      Config.create(
        {
          binLinks: true,
          cwd: prepareDirectory,
          disablePrepublish: true,
          production: false,
        },
        this.reporter,
      ),
      Lockfile.fromDirectory(prepareDirectory, this.reporter),
    ]);
    await install(prepareConfig, this.reporter, {}, prepareLockFile);

    const tarballMirrorPath = this.getTarballMirrorPath();
    const tarballCachePath = this.getTarballCachePath();

    if (tarballMirrorPath) {
      await this._packToTarball(prepareConfig, tarballMirrorPath);
    }
    if (tarballCachePath) {
      await this._packToTarball(prepareConfig, tarballCachePath);
    }

    await this._packToDirectory(prepareConfig, this.dest);

    await fsUtil.unlink(prepareDirectory);
  }

  async _packToTarball(config: Config, path: string): Promise<void> {
    const tarballStream = await this._createTarballStream(config);
    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(path);
      tarballStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('end', resolve);
      writeStream.on('open', () => {
        tarballStream.pipe(writeStream);
      });
      writeStream.once('finish', resolve);
    });
  }

  async _packToDirectory(config: Config, dest: string): Promise<void> {
    const tarballStream = await this._createTarballStream(config);
    await new Promise((resolve, reject) => {
      const untarStream = this._createUntarStream(dest);
      tarballStream.on('error', reject);
      untarStream.on('error', reject);
      untarStream.on('end', resolve);
      untarStream.once('finish', resolve);
      tarballStream.pipe(untarStream);
    });
  }

  _createTarballStream(config: Config): Promise<stream$Duplex> {
    let savedPackedHeader = false;
    return packTarball(config, {
      mapHeader(header: Object): Object {
        if (!savedPackedHeader) {
          savedPackedHeader = true;
          header.pax = header.pax || {};
          // add a custom data on the first header
          // in order to distinguish a tar from "git archive" and a tar from "pack" command
          header.pax.packed = PACKED_FLAG;
        }
        return header;
      },
    });
  }

  _createUntarStream(dest: string): stream$Writable {
    const PREFIX = 'package/';
    let isPackedTarball = undefined;
    return tarFs.extract(dest, {
      dmode: 0o555, // all dirs should be readable
      fmode: 0o444, // all files should be readable
      chown: false, // don't chown. just leave as it is
      map: header => {
        if (isPackedTarball === undefined) {
          isPackedTarball = header.pax && header.pax.packed === PACKED_FLAG;
        }
        if (isPackedTarball) {
          header.name = header.name.substr(PREFIX.length);
        }
      },
    });
  }

  async fetchFromGitArchive(git: Git): Promise<void> {
    await git.clone(this.dest);
    const tarballMirrorPath = this.getTarballMirrorPath();
    const tarballCachePath = this.getTarballCachePath();

    if (tarballMirrorPath) {
      await git.archive(tarballMirrorPath);
    }

    if (tarballCachePath) {
      await git.archive(tarballCachePath);
    }
  }

  _fetch(): Promise<FetchedOverride> {
    return this.fetchFromLocal().catch(err => this.fetchFromExternal());
  }
}
