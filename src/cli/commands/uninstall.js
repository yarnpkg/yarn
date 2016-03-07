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

import type { Reporter } from "kreporters";
import type Config from "../../config.js";
import { MessageError } from "../../errors.js";
import * as fs from "../../util/fs.js";

let path = require("path");

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>
): Promise<void> {
  if (!args.length) {
    throw new MessageError("Expected one or more arguments");
  }

  for (let name of args) {
    let loc = path.join(config.modulesFolder, name);

    if (!(await fs.exists(loc))) {
      throw new MessageError(`Couldn't find module ${name}`);
    }

    // read package.json
    let pkg = await config.readManifest(loc);

    // remove bins
    for (let binName in pkg.bin) {
      await fs.unlink(path.join(config.modulesFolder, ".bin", binName));
    }

    // remove entire package
    await fs.unlink(loc);

    // TODO: remove from `package.json`
    
    // TODO: remove from lockfile
  }
}
