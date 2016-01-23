/* @flow */

import type Reporter from "../../reporters/_base";
import type Config from "../../config";
import { MessageError } from "../../errors";
import * as fs from "../../util/fs";
import executeLifecycleScript from "../../util/execute-lifecycle-script";
import { getSubArguments } from "../arg-utils";

let _ = require("lodash");

export let minArgumentLength = 1;

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>
): Promise<void> {
  let action = args[0];
  let pkg = await fs.readPackageJson(config.cwd);

  if (!pkg.scripts || !_.has(pkg.scripts, action)) {
    throw new MessageError(`No scripts.${action} command specified!`);
  }

  await executeLifecycleScript(config.cwd, [
    `${pkg.scripts[action]} ${getSubArguments(args, minArgumentLength)}`
  ]);
}
