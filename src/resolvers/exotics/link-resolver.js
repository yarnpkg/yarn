/* @flow */

import type {Manifest} from '../../types.js';
import type {RegistryNames} from '../../registries/index.js';
import type PackageRequest from '../../package-request.js';
import ExoticResolver from './exotic-resolver.js';
import * as util from '../../util/misc.js';
import * as fs from '../../util/fs.js';

const path = require('path');

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

    return manifest;
  }
}
