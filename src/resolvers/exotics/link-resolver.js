/* @flow */

import type {Manifest} from '../../types.js';
import type {RegistryNames} from '../../registries/index.js';
import type PackageRequest from '../../package-request.js';
import ExoticResolver from './exotic-resolver.js';
import * as util from '../../util/misc.js';
import * as fs from '../../util/fs.js';

const path = require('path');

type Dependencies = {
  [key: string]: string,
};

export default class LinkResolver extends ExoticResolver {
  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);
    this.loc = util.removePrefix(fragment, 'link:');
  }

  loc: string;

  static protocol = 'link';

  async resolve(): Promise<Manifest> {
    let loc = this.loc;
    if (!path.isAbsolute(loc)) {
      loc = path.join(this.config.cwd, loc);
    }

    const name = path.basename(loc);
    const registry: RegistryNames = 'npm';

    const manifest: Manifest = !await fs.exists(loc)
      ? {_uid: '', name, version: '0.0.0', _registry: registry}
      : await this.config.readManifest(loc, this.registry);

    manifest._remote = {
      type: 'link',
      registry,
      hash: null,
      reference: loc,
    };

    manifest._uid = manifest.version;

    // Normalize relative paths; if anything changes, make a copy of the manifest
    const dependencies = this.normalizeDependencyPaths(manifest.dependencies, loc);
    const optionalDependencies = this.normalizeDependencyPaths(manifest.optionalDependencies, loc);

    if (dependencies !== manifest.dependencies || optionalDependencies !== manifest.optionalDependencies) {
      const _manifest = Object.assign({}, manifest);
      if (dependencies != null) {
        _manifest.dependencies = dependencies;
      }
      if (optionalDependencies != null) {
        _manifest.optionalDependencies = optionalDependencies;
      }
      return _manifest;
    } else {
      return manifest;
    }
  }

  normalizeDependencyPaths(section: ?Dependencies, loc: string): ?Dependencies {
    if (section == null) {
      return section;
    }

    let temp = section;

    for (const [k, v] of util.entries(section)) {
      if (typeof v === 'string' && v.startsWith('link:') && !path.isAbsolute(v)) {
        if (temp === section) {
          temp = Object.assign({}, section);
        }
        temp[k] = `link:${path.relative(this.config.cwd, path.join(loc, util.removePrefix(v, 'link:')))}`;
      }
    }

    return temp;
  }
}
