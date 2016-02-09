/* @flow */

import type Reporter from "../../reporters/_base.js";
import type Config from "../../config.js";
import { MessageError } from "../../errors.js";
import * as fs from "../../util/fs.js";
import executeLifecycleScript from "../../util/execute-lifecycle-script.js";
import { getSubArguments } from "../arg-utils.js";

export let minArgumentLength = 1;

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>
): Promise<void> {
  let action = args[0];
  let pkg = await fs.readPackageJson(config.cwd);

  if (!pkg.scripts || !pkg.scripts[action]) {
    throw new MessageError(`No scripts.${action} command specified!`);
  }

  await executeLifecycleScript(config, config.cwd, [
    `${pkg.scripts[action]} ${getSubArguments(args, minArgumentLength)}`
  ]);
}
