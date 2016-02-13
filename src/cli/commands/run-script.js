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

import type Reporter from "../../reporters/_base.js";
import type Config from "../../config.js";
import { MessageError } from "../../errors.js";
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
  let pkg = await config.readPackageJson(config.cwd);

  if (!pkg.scripts || !pkg.scripts[action]) {
    throw new MessageError(`No scripts.${action} command specified!`);
  }

  await executeLifecycleScript(config, config.cwd, [
    `${pkg.scripts[action]} ${getSubArguments(args, minArgumentLength)}`
  ]);
}
