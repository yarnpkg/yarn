/* @flow */

import type {Manifest} from '../../types.js';
import {MessageError} from '../../errors.js';
import RegistryResolver from './registry-resolver.js';
import NpmRegistry from '../../registries/npm-registry.js';
import map from '../../util/map.js';
import * as fs from '../../util/fs.js';

const invariant = require('invariant');
const path = require('path');

type RegistryResponse = {
  name: string,
  versions: { [key: string]: Manifest },
  "dist-tags": { [key: string]: string },
};

export default class NpmResolver extends RegistryResolver {
  static registry = 'npm';

  async findVersionInRegistryResponse(body: RegistryResponse): Promise<Manifest> {
    let range = this.range;

    if (range in body['dist-tags']) {
      range = body['dist-tags'][range];
    }

    const satisfied = await this.config.resolveConstraints(Object.keys(body.versions), range);
    if (satisfied) {
      return body.versions[satisfied];
    } else {
      throw new MessageError(
        `Couldn't find any versions for ${body.name} that matches ${range}. ` +
        `Possible versions: ${Object.keys(body.versions).join(', ')}`,
      );
    }
  }

  async resolveRequest(): Promise<?Manifest> {
    if (this.config.offline) {
      let res = this.resolveRequestOffline();
      if (res != null) {
        return res;
      }
    }

    const body = await this.config.registries.npm.request(NpmRegistry.escapeName(this.name));

    if (body) {
      return await this.findVersionInRegistryResponse(body);
    } else {
      return null;
    }
  }

  async resolveRequestOffline(): Promise<?Manifest> {
    // find modules of this name
    const prefix = `npm-${this.name}-`;

    const packagesRoot = this.config.packagesRoot;
    invariant(packagesRoot, 'expected packages root');

    const files = await this.config.getCache('cachedPackages', async (): Promise<Array<string>> => {
      const files = await fs.readdir(packagesRoot);
      const validFiles = [];

      for (const name of files) {
        // no hidden files
        if (name[0] === '.') {
          continue;
        }

        // ensure valid module cache
        const dir = path.join(packagesRoot, name);
        if (await this.config.isValidModuleDest(dir)) {
          validFiles.push(name);
        }
      }

      return validFiles;
    });

    const versions = map();

    for (const name of files) {
      // check if folder starts with our prefix
      if (name.indexOf(prefix) !== 0) {
        continue;
      }

      const dir = path.join(packagesRoot, name);

      // read manifest and validate correct name
      const pkg = await this.config.readManifest(dir, 'npm');
      if (pkg.name !== this.name) {
        continue;
      }

      // read package metadata
      const metadata = await this.config.readPackageMetadata(dir);
      if (!metadata._remote) {
        continue; // old yarn metadata
      }

      versions[pkg.version] = Object.assign({}, pkg, {_remote: metadata.remote});
    }

    const satisfied = await this.config.resolveConstraints(Object.keys(versions), this.range);
    if (satisfied) {
      return versions[satisfied];
    } else if (!this.config.preferOffline) {
      throw new MessageError(
        this.reporter.lang(
          'couldntFindPackageInCache',
          this.name,
          this.range,
          Object.keys(versions).join(', '),
        ),
      );
    } else {
      return null;
    }
  }

  async resolve(): Promise<Manifest> {
    // lockfile
    const shrunk = this.request.getLocked('tarball');
    if (shrunk) {
      return shrunk;
    }

    const info = await this.resolveRequest();
    if (info == null) {
      throw new MessageError(this.reporter.lang('packageNotFoundRegistry', this.name, 'npm'));
    }

    if (typeof info.deprecated === 'string') {
      const deprecated = info.deprecated;
      let human = `${info.name}@${info.version}`;
      const parentNames = this.request.getParentNames();
      if (parentNames.length) {
        human = parentNames.concat(human).join(' > ');
      }
      this.reporter.warn(`${human}: ${deprecated}`);
    }

    if (info.dist && info.dist.tarball) {
      info._remote = {
        resolved: `${info.dist.tarball}#${info.dist.shasum}`,
        type: 'tarball',
        reference: info.dist.tarball,
        hash: info.dist.shasum,
        registry: 'npm',
      };
    }

    info._uid = info.version;

    return info;
  }
}
