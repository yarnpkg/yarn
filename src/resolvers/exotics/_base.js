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

import BaseResolver from '../_base.js';

const _ = require('lodash');

export default class ExoticResolver extends BaseResolver {
  static protocol: string;

  static isVersion(pattern: string): boolean {
    const proto = this.protocol;
    if (proto) {
      return _.startsWith(pattern, `${proto}:`);
    } else {
      throw new Error('No protocol specified');
    }
  }
}
