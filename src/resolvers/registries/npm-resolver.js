/* @flow */

import type {Manifest} from '../../types.js';
import type Config from '../../config.js';
import type PackageRequest from '../../package-request.js';
import {MessageError} from '../../errors.js';
import RegistryResolver from './registry-resolver.js';
import NpmRegistry, {SCOPE_SEPARATOR} from '../../registries/npm-registry.js';
import map from '../../util/map.js';
import * as fs from '../../util/fs.js';
import {YARN_REGISTRY} from '../../constants.js';

const inquirer = require('inquirer');
const tty = require('tty');
const invariant = require('invariant');
const path = require('path');

const NPM_REGISTRY = /http[s]:\/\/registry.npmjs.org/g;
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
    range: string,
    body: RegistryResponse,
    request: ?PackageRequest,
  ): Promise<Manifest> {
    if (!body['dist-tags']) {
      throw new MessageError(config.reporter.lang('malformedRegistryResponse', body.name));
    }

    if (range in body['dist-tags']) {
      range = body['dist-tags'][range];
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
          choices: Object.keys(body.versions).reverse(),
          pageSize,
        },
      ]);
      if (response && response.package) {
        return body.versions[response.package];
      }
    }
    throw new MessageError(config.reporter.lang('couldntFindVersionThatMatchesRange', body.name, range));
  }

  async resolveRequest(): Promise<?Manifest> {
    if (this.config.offline) {
      const res = await this.resolveRequestOffline();
      if (res != null) {
        return res;
      }
    }

    const body = await this.config.registries.npm.request(NpmRegistry.escapeName(this.name));

    if (body) {
      return NpmResolver.findVersionInRegistryResponse(this.config, this.range, body, this.request);
    } else {
      return null;
    }
  }

  async resolveRequestOffline(): Promise<?Manifest> {
    const escapedName = NpmRegistry.escapeName(this.name);
    const scope = this.config.registries.npm.getScope(escapedName);

    // find modules of this name
    const prefix = scope ? escapedName.split(SCOPE_SEPARATOR)[1] : `${NPM_REGISTRY_ID}-${this.name}-`;

    invariant(this.config.cacheFolder, 'expected packages root');
    const cacheFolder = path.join(this.config.cacheFolder, scope ? `${NPM_REGISTRY_ID}-${scope}` : '');

    const files = await this.config.getCache('cachedPackages', async (): Promise<Array<string>> => {
      const files = await fs.readdir(cacheFolder);
      const validFiles = [];

      for (const name of files) {
        // no hidden files
        if (name[0] === '.') {
          continue;
        }

        // ensure valid module cache
        const dir = path.join(cacheFolder, name);
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

      const dir = path.join(cacheFolder, name);

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
      return url.replace(NPM_REGISTRY, YARN_REGISTRY);
    } else {
      return url;
    }
  }

  async resolve(): Promise<Manifest> {
    // lockfile
    const shrunk = this.request.getLocked('tarball');
    if (shrunk) {
      return shrunk;
    }

    const info: ?Manifest = await this.resolveRequest();
    if (info == null) {
      throw new MessageError(this.reporter.lang('packageNotFoundRegistry', this.name, NPM_REGISTRY_ID));
    }

    const {deprecated, dist} = info;
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
        registry: NPM_REGISTRY_ID,
        packageName: info.name,
      };
    }

    info._uid = info.version;

    return info;
  }
}
