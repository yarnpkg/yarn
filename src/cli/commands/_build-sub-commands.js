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
import {MessageError} from '../../errors.js';

let _ = require('lodash');

type RunCommand = (
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
) => Promise<void>;

type SubCommands =  {
  [commandName: string]: RunCommand
};

type Return = {
  run: RunCommand,
  setFlags: (commander: Object) => void,
};

type Usage = Array<string>;

export default function(rootCommandName: string, subCommands: SubCommands, usage?: Usage = []): Return {
  let subCommandNames = Object.keys(subCommands);

  function setFlags(commander: Object) {
    commander.usage(`${rootCommandName} [${subCommandNames.join(' | ')}] [flags]`);
  }

  async function run(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    let subName = _.camelCase(args.shift() || '');
    if (!subName || subCommandNames.indexOf(subName) < 0) {
      reporter.error(`Usage:`);
      for (let msg of usage) {
        reporter.error(`kpm ${rootCommandName} ${msg}`);
      }
      return Promise.reject();
    } else {  
      let command: RunCommand = subCommands[subName];
      await command(config, reporter, flags, args);
      return Promise.resolve();
    }
  }

  return {run, setFlags};
}
