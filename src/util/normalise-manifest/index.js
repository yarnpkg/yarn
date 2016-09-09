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
import type Config from '../../config.js';
import validate from './validate.js';
import fix from './fix.js';

export default async function (info: Object, moduleLoc: string, config: Config): Promise<Manifest> {
  await fix(info, moduleLoc, config.reporter);

  let {name, version} = info;
  let human: ?string;
  if (typeof name === 'string') {
    human = name;
  }
  if (human && typeof version === 'string') {
    name += `@${version}`;
  }
  validate(info, (msg: string) => {
    if (human) {
      msg = `${human}: ${msg}`;
    }
    config.reporter.warn(msg);
  });

  return info;
}
