/* @flow */

import type Reporter from "../../reporters/_base.js";
import type Config from "../../config.js";
import normalisePackageInfo from "../../util/normalise-package-info/index.js";
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
    let pkg = await fs.readPackageJson(loc);
    pkg = await normalisePackageInfo(pkg, loc);

    // remove bins
    for (let binName in pkg.bin) {
      await fs.unlink(path.join(config.modulesFolder, ".bin", binName));
    }

    // remove entire package
    await fs.unlink(loc);
  }
}
