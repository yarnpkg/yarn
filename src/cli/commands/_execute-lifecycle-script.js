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

import type Config from "../../config.js";
import { MessageError } from "../../errors.js";
import executeLifecycleScript from "../../util/execute-lifecycle-script.js";
import * as commands from "./index.js";

let leven = require("leven");

export default function (action: string): { run: Function, argumentLength: number } {
  return {
    argumentLength: 0,

    run: async function (config: Config): Promise<void> {
      let pkg = await config.readManifest(config.cwd);

      if (!pkg.scripts || !pkg.scripts[action]) {
        let suggestion;

        for (let commandName in commands) {
          let steps = leven(commandName, action);
          if (steps < 2) {
            suggestion = commandName;
          }
        }

        let msg = `Command ${JSON.stringify(action)} not found.`;
        if (suggestion) msg += ` Did you mean ${JSON.stringify(suggestion)}?`;
        throw new MessageError(msg);
      }

      await executeLifecycleScript(config, config.cwd, [pkg.scripts[action]]);
    }
  };
}
