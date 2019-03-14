/* @flow */
/* eslint no-unused-vars: 0 */

import type Reporter from '../reporters/base-reporter.js';
import type {PackageRemote, FetchedMetadata, FetchedOverride} from '../types.js';
import type {RegistryNames} from '../registries/index.js';
import type Config from '../config.js';
import normalizeManifest from '../util/normalize-manifest/index.js';
import * as constants from '../constants.js';
import * as fs from '../util/fs.js';
import lockMutex from '../util/mutex.js';

const cmdShim = require('@zkochan/cmd-shim');
const path = require('path');

export default class BaseFetcher {
  constructor(dest: string, remote: PackageRemote, config: Config) {
    this.reporter = config.reporter;
    this.packageName = remote.packageName;
    this.reference = remote.reference;
    this.registry = remote.registry;
    this.hash = remote.hash;
    this.remote = remote;
    this.config = config;
    this.dest = dest;
  }

  reporter: Reporter;
  remote: PackageRemote;
  registry: RegistryNames;
  packageName: ?string;
  reference: string;
  config: Config;
  hash: ?string;
  dest: string;

  setupMirrorFromCache(): Promise<?string> {
    // fetcher subclasses may use this to perform actions such as copying over a cached tarball to the offline
    // mirror etc
    return Promise.resolve();
  }

  _fetch(): Promise<FetchedOverride> {
    return Promise.reject(new Error('Not implemented'));
  }

  fetch(defaultManifest: ?Object): Promise<FetchedMetadata> {
    return fs.lockQueue.push(this.dest, async (): Promise<FetchedMetadata> => {
      await fs.mkdirp(this.dest);

      // fetch package and get the hash
      const {hash} = await this._fetch();

      const pkg = await (async () => {
        // load the new normalized manifest
        try {
          return await this.config.readManifest(this.dest, this.registry);
        } catch (e) {
          if (e.code === 'ENOENT' && defaultManifest) {
            return normalizeManifest(defaultManifest, this.dest, this.config, false);
          } else {
            throw e;
          }
        }
      })();

      if (pkg.bin) {
        for (const binName of Object.keys(pkg.bin)) {
          const binDest = `${this.dest}/.bin`;

          // Using any sort of absolute path here would prevent makePortableProxyScript from preserving symlinks when
          // calling the binary
          const src = path.resolve(this.dest, pkg.bin[binName]);

          if (await fs.exists(src)) {
            // We ensure that the target is executable
            await fs.chmod(src, 0o755);
          }

          await fs.mkdirp(binDest);
          if (process.platform === 'win32') {
            const unlockMutex = await lockMutex(src);
            try {
              await cmdShim.ifExists(src, `${binDest}/${binName}`, {createPwshFile: false});
            } finally {
              unlockMutex();
            }
          } else {
            await fs.symlink(src, `${binDest}/${binName}`);
          }
        }
      }

      await fs.writeFile(
        path.join(this.dest, constants.METADATA_FILENAME),
        JSON.stringify(
          {
            manifest: pkg,
            artifacts: [],
            remote: this.remote,
            registry: this.registry,
            hash,
          },
          null,
          '  ',
        ),
      );

      return {
        hash,
        dest: this.dest,
        package: pkg,
        cached: false,
      };
    });
  }
}
