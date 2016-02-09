/* @flow */

import type Config from "../../config.js";
import { MessageError } from "../../errors.js";
import * as fs from "../../util/fs.js";
import executeLifecycleScript from "../../util/execute-lifecycle-script.js";

export default function (action: string): { run: Function, argumentLength: number } {
  return {
    argumentLength: 0,

    run: async function (config: Config): Promise<void> {
      let pkg = await fs.readPackageJson(config.cwd);

      if (!pkg.scripts || !pkg.scripts[action]) {
        throw new MessageError(`No scripts.${action} command specified!`);
      }

      await executeLifecycleScript(config, config.cwd, [pkg.scripts[action]]);
    }
  };
}
