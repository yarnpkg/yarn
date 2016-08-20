/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import type {Manifest} from '../../types.js';
import type PackageRequest from '../../PackageRequest.js';
import {MessageError} from '../../errors.js';
import ExoticResolver from './ExoticResolver.js';

export default class RegistryResolver extends ExoticResolver {
  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);

    const match = fragment.match(/^(\S+):(.*?)(@(.*?)|)$/);
    if (match) {
      this.range = match[4] || 'latest';
      this.name = match[2];
    } else {
      throw new MessageError(`Invalid fragment ${fragment}`);
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
