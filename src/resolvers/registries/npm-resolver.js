/* @flow */

import {getCachedPackagesDirs} from '../../cli/commands/cache.js';
import type {Manifest} from '../../types.js';
import type Config from '../../config.js';
import type PackageRequest from '../../package-request.js';
import {MessageError} from '../../errors.js';
import RegistryResolver from './registry-resolver.js';
import NpmRegistry from '../../registries/npm-registry.js';
import map from '../../util/map.js';
import * as fs from '../../util/fs.js';
import {YARN_REGISTRY, NPM_REGISTRY_RE} from '../../constants.js';
import {getPlatformSpecificPackageFilename} from '../../util/package-name-utils.js';

const inquirer = require('inquirer');
const tty = require('tty');
const path = require('path');
const semver = require('semver');
const ssri = require('ssri');

const NPM_REGISTRY_ID = 'npm';

type RegistryResponse = {
  name: string,
  versions: {[key: string]: Manifest},
  'dist-tags': {[key: string]: string},
};

export default class NpmResolver extends RegistryResolver {
  static registry = NPM_REGISTRY_ID;

  static async findVersionInRegistryResponse(
    config: Config,
    name: string,
    range: string,
    body: RegistryResponse,
    request: ?PackageRequest,
  ): Promise<Manifest> {
    if (body.versions && Object.keys(body.versions).length === 0) {
      throw new MessageError(config.reporter.lang('registryNoVersions', body.name));
    }

    if (!body['dist-tags'] || !body.versions) {
      throw new MessageError(config.reporter.lang('malformedRegistryResponse', name));
    }

    if (range in body['dist-tags']) {
      range = body['dist-tags'][range];
    }

    // If the latest tag in the registry satisfies the requested range, then use that.
    // Otherwise we will fall back to semver maxSatisfying.
    // This mimics logic in NPM. See issue #3560
    const latestVersion = body['dist-tags'] ? body['dist-tags'].latest : undefined;
    if (latestVersion && semver.satisfies(latestVersion, range)) {
      return body.versions[latestVersion];
    }

    const satisfied = await config.resolveConstraints(Object.keys(body.versions), range);
    if (satisfied) {
      return body.versions[satisfied];
    } else if (request && !config.nonInteractive) {
      if (request.resolver && request.resolver.activity) {
        request.resolver.activity.end();
      }
      config.reporter.log(config.reporter.lang('couldntFindVersionThatMatchesRange', body.name, range));
      let pageSize;
      if (process.stdout instanceof tty.WriteStream) {
        pageSize = process.stdout.rows - 2;
      }
      const response: {[key: string]: ?string} = await inquirer.prompt([
        {
          name: 'package',
          type: 'list',
          message: config.reporter.lang('chooseVersionFromList', body.name),
          choices: (semver: Object).rsort(Object.keys(body.versions)),
          pageSize,
        },
      ]);
      if (response && response.package) {
        return body.versions[response.package];
      }
    }
    throw new MessageError(config.reporter.lang('couldntFindVersionThatMatchesRange', body.name, range));
  }

  async resolveRequest(desiredVersion: ?string): Promise<?Manifest> {
    if (this.config.offline) {
      const res = await this.resolveRequestOffline();
      if (res != null) {
        return res;
      }
    }

    const escapedName = NpmRegistry.escapeName(this.name);
    const desiredRange = desiredVersion || this.range;
    const body = await this.config.registries.npm.request(escapedName);

    if (body) {
      return NpmResolver.findVersionInRegistryResponse(this.config, escapedName, desiredRange, body, this.request);
    } else {
      return null;
    }
  }

  async resolveRequestOffline(): Promise<?Manifest> {
    const packageDirs = await this.config.getCache('cachedPackages', (): Promise<Array<string>> => {
      return getCachedPackagesDirs(this.config, this.config.cacheFolder);
    });

    const versions = map();

    for (const dir of packageDirs) {
      // check if folder contains the registry prefix
      if (dir.indexOf(`${NPM_REGISTRY_ID}-`) === -1) {
        continue;
      }

      // read manifest and validate correct name
      const pkg = await this.config.readManifest(dir, NPM_REGISTRY_ID);
      if (pkg.name !== this.name) {
        continue;
      }

      // read package metadata
      const metadata = await this.config.readPackageMetadata(dir);
      if (!metadata.remote) {
        continue; // old yarn metadata
      }

      versions[pkg.version] = Object.assign({}, pkg, {
        _remote: metadata.remote,
      });
    }

    const satisfied = await this.config.resolveConstraints(Object.keys(versions), this.range);
    if (satisfied) {
      return versions[satisfied];
    } else if (!this.config.preferOffline) {
      throw new MessageError(
        this.reporter.lang('couldntFindPackageInCache', this.name, this.range, Object.keys(versions).join(', ')),
      );
    } else {
      return null;
    }
  }

  cleanRegistry(url: string): string {
    if (this.config.getOption('registry') === YARN_REGISTRY) {
      return url.replace(NPM_REGISTRY_RE, YARN_REGISTRY);
    } else {
      return url;
    }
  }

  async resolve(): Promise<Manifest> {
    // lockfile
    const shrunk = this.request.getLocked('tarball');
    if (shrunk) {
      if (this.config.packBuiltPackages && shrunk.prebuiltVariants && shrunk._remote) {
        const prebuiltVariants = shrunk.prebuiltVariants;
        const prebuiltName = getPlatformSpecificPackageFilename(shrunk);
        const offlineMirrorPath = this.config.getOfflineMirrorPath();
        if (prebuiltVariants[prebuiltName] && offlineMirrorPath) {
          const filename = path.join(offlineMirrorPath, 'prebuilt', prebuiltName + '.tgz');
          const {_remote} = shrunk;
          if (_remote && (await fs.exists(filename))) {
            _remote.reference = `file:${filename}`;
            _remote.hash = prebuiltVariants[prebuiltName];
            _remote.integrity = ssri.fromHex(_remote.hash, 'sha1').toString();
          }
        }
      }
    }
    if (
      shrunk &&
      shrunk._remote &&
      (shrunk._remote.integrity || this.config.offline || !this.config.autoAddIntegrity)
    ) {
      // if the integrity field does not exist, we're not network-restricted, and the
      // migration hasn't been disabled, it needs to be created
      return shrunk;
    }

    const desiredVersion = shrunk && shrunk.version ? shrunk.version : null;
    const info: ?Manifest = await this.resolveRequest(desiredVersion);
    if (info == null) {
      throw new MessageError(this.reporter.lang('packageNotFoundRegistry', this.name, NPM_REGISTRY_ID));
    }

    const {deprecated, dist} = info;
    if (shrunk && shrunk._remote) {
      shrunk._remote.integrity =
        dist && dist.integrity
          ? ssri.parse(dist.integrity)
          : ssri.fromHex(dist && dist.shasum ? dist.shasum : '', 'sha1');
      return shrunk;
    }

    if (typeof deprecated === 'string') {
      let human = `${info.name}@${info.version}`;
      const parentNames = this.request.parentNames;
      if (parentNames.length) {
        human = parentNames.concat(human).join(' > ');
      }
      this.reporter.warn(`${human}: ${deprecated}`);
    }

    if (dist != null && dist.tarball) {
      info._remote = {
        resolved: `${this.cleanRegistry(dist.tarball)}#${dist.shasum}`,
        type: 'tarball',
        reference: this.cleanRegistry(dist.tarball),
        hash: dist.shasum,
        integrity: dist.integrity ? ssri.parse(dist.integrity) : ssri.fromHex(dist.shasum, 'sha1'),
        registry: NPM_REGISTRY_ID,
        packageName: info.name,
      };
    }

    info._uid = info.version;

    return info;
  }
}
