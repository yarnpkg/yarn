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

import type PackageRequest from '../../package-request.js';
import type { RegistryNames } from '../../registries/index.js';
import BaseResolver from '../_base.js';

export default class RegistryResolver extends BaseResolver {
  constructor(request: PackageRequest, name: string, range: string) {
    super(request, `${name}@${range}`);
    this.name  = name;
    this.range = range;

    this.registryConfig = request.config.registries[this.constructor.registry].config;
  }

  name: string;
  range: string;

  static registry: RegistryNames;
  registryConfig: Object;

  async warmCache(): Promise<void> {}

  async resolveRequest(): Promise<any> {
    await this.warmCache();
  }
}
