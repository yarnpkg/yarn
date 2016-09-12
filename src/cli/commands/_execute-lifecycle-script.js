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

import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import executeLifecycleScript from '../../util/execute-lifecycle-script.js';
import * as commands from './index.js';

const leven = require('leven');

export default function(action: string): { run: Function, argumentLength: number } {
  let actions = [`pre${action}`, action, `post${action}`];
  return {
    argumentLength: 0,

    async run(config: Config): Promise<void> {
      const pkg = await config.readRootManifest();

      // build up list of commands for this script
      let scripts = pkg.scripts || {};
      let cmds = [];
      for (let action of actions) {
        let cmd = scripts[action];
        if (cmd) {
          cmds.push(cmd);
        }
      }

      if (cmds.length) {
        await executeLifecycleScript(config, config.cwd, cmds);
      } else {
        let suggestion;

        for (const commandName in commands) {
          const steps = leven(commandName, action);
          if (steps < 2) {
            suggestion = commandName;
          }
        }

        let msg = `Command ${JSON.stringify(action)} not found.`;
        if (suggestion) {
          msg += ` Did you mean ${JSON.stringify(suggestion)}?`;
        }
        throw new MessageError(msg);
      }
    },
  };
}
