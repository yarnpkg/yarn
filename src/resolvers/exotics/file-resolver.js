/* @flow */

import type {Manifest} from '../../types.js';
import type PackageRequest from '../../package-request.js';
import type {RegistryNames} from '../../registries/index.js';
import {MessageError} from '../../errors.js';
import ExoticResolver from './exotic-resolver.js';
import * as util from '../../util/misc.js';
import * as fs from '../../util/fs.js';

const invariant = require('invariant');
const path = require('path');
const uuid = require('uuid');

type Dependencies = {
  [key: string]: string,
};

const FILE_PROTOCOL_PREFIX = 'file:';

export default class FileResolver extends ExoticResolver {
  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);
    this.loc = util.removePrefix(fragment, FILE_PROTOCOL_PREFIX);
  }

  loc: string;

  static protocol = 'file';

  async resolve(): Promise<Manifest> {
    let loc = this.loc;
    if (!path.isAbsolute(loc)) {
      loc = path.join(this.config.cwd, loc);
    }

    if (this.config.linkFileDependencies) {
      const registry: RegistryNames = 'npm';
      const manifest: Manifest = {_uid: '', name: '', version: '0.0.0', _registry: registry};
      manifest._remote = {
        type: 'link',
        registry,
        hash: null,
        reference: loc,
      };
      manifest._uid = manifest.version;
      return manifest;
    }
    if (!await fs.exists(loc)) {
      throw new MessageError(this.reporter.lang('doesntExist', loc));
    }

    const manifest: Manifest = await (async () => {
      try {
        return await this.config.readManifest(loc, this.registry);
      } catch (e) {
        if (e.code === 'ENOENT') {
          return {
            // This is just the default, it can be overridden with key of dependencies
            name: path.dirname(loc),
            version: '0.0.0',
            _uid: '0.0.0',
            _registry: 'npm',
          };
        }

        throw e;
      }
    })();
    const registry = manifest._registry;
    invariant(registry, 'expected registry');

    manifest._remote = {
      type: 'copy',
      registry,
      hash: `${uuid.v4()}-${new Date().getTime()}`,
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
      if (
        typeof v === 'string' &&
        v.startsWith(FILE_PROTOCOL_PREFIX) &&
        !path.isAbsolute(v.substring(FILE_PROTOCOL_PREFIX.length))
      ) {
        if (temp === section) {
          temp = Object.assign({}, section);
        }
        temp[k] = `${FILE_PROTOCOL_PREFIX}${path.relative(
          this.config.cwd,
          path.join(loc, util.removePrefix(v, FILE_PROTOCOL_PREFIX)),
        )}`;
      }
    }

    return temp;
  }
}
