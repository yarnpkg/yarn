/* @flow */

import type Reporter from "../../reporters/_base";
import type Config from "../../config";
import normalisePackageInfo from "../../util/normalise-package-info"
import { MessageError } from "../../errors";
import * as fs from "../../util/fs";

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
