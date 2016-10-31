/* @flow */

import type {Manifest} from '../../types.js';
import type {RegistryNames} from '../../registries/index.js';
import type PackageRequest from '../../package-request.js';
import ExoticResolver from './exotic-resolver.js';
import * as util from '../../util/misc.js';

const path = require('path');

export default class FileResolver extends ExoticResolver {
  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);
    this.loc = util.removePrefix(fragment, 'link:');
  }

  loc: string;

  static protocol = 'link';

  resolve(): Promise<Manifest> {
    let loc = this.loc;
    if (!path.isAbsolute(loc)) {
      loc = path.join(this.config.cwd, loc);
    }

    const registry: RegistryNames = 'npm';
    const manifest: Manifest = {_uid: '', name: '', version: '0.0.0', _registry: registry};

    manifest._remote = {
      type: 'link',
      registry,
      reference: loc,
    };

    manifest._uid = manifest.version;

    return Promise.resolve(manifest);
  }
}
