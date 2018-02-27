/* @flow */

import type {Manifest} from '../../types.js';
import type PackageRequest from '../../package-request.js';
import {MessageError} from '../../errors.js';
import ExoticResolver from './exotic-resolver.js';

export default class RegistryResolver extends ExoticResolver {
  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);

    const match = fragment.match(/^(\S+):(@?.*?)(@(.*?)|)$/);
    if (match) {
      this.range = match[4] || 'latest';
      this.name = match[2];
    } else {
      throw new MessageError(this.reporter.lang('invalidFragment', fragment));
    }

    // $FlowFixMe
    this.registry = this.constructor.protocol;
  }

  static factory: Function;
  name: string;
  range: string;

  resolve(): Promise<Manifest> {
    return this.fork(this.constructor.factory, false, this.name, this.range);
  }
}
