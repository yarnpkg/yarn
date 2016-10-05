/* @flow */

import type {Manifest} from '../../types.js';
import type PackageRequest from '../../package-request.js';
import {MessageError} from '../../errors.js';
import ExoticResolver from './exotic-resolver.js';
import * as util from '../../util/misc.js';
import * as fs from '../../util/fs.js';

const invariant = require('invariant');
const path = require('path');

export default class FileResolver extends ExoticResolver {
  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);
    this.loc = util.removePrefix(fragment, 'file:');
  }

  loc: string;

  static protocol = 'file';

  async resolve(): Promise<Manifest> {
    let loc = this.loc;
    if (!path.isAbsolute(loc)) {
      loc = path.join(this.config.cwd, loc);
    }
    if (!(await fs.exists(loc))) {
      throw new MessageError(this.reporter.lang('doesntExist', loc));
    }

    const manifest = await this.config.readManifest(loc, this.registry);
    const registry = manifest._registry;
    invariant(registry, 'expected registry');

    manifest._remote = {
      type: 'copy',
      registry,
      reference: loc,
    };

    manifest._uid = manifest.version;

    return manifest;
  }
}
