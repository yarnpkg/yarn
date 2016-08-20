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

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import buildSubCommands from './_build-sub-commands.js';

export let {run, setFlags} = buildSubCommands('owner', {
  async add(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    let user = args.shift();
    let pkg = args.shift();

    throw new Error('TODO');
  },

  async rm(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    let user = args.shift();
    let pkg = args.shift();

    throw new Error('TODO');
  },

  async ls(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    let pkg = args.shift();

    throw new Error('TODO');
  },
}, [
  'add <user> [<@scope>/]<pkg>',
  'rm <user> [<@scope>/]<pkg>',
  'ls [<@scope>/]<pkg>',
]);
