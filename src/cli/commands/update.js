/* @flow */

import type Reporter from "../../reporters/_base.js";
import type Config from "../../config.js";
import { Install } from "./install.js";
import Lockfile from "../../lockfile/index.js";
import { MessageError } from "../../errors.js";
import * as constants from "../../constants.js";
import * as fs from "../../util/fs.js";

let path = require("path");

export function setFlags(commander: Object) {
  // TODO: support some flags that install command has
  commander;
}

export let noArguments = true;

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>
): Promise<void> {
  if (!await fs.exists(path.join(config.cwd, constants.LOCKFILE_FILENAME))) {
    throw new MessageError("No lockfile in this directory. Run `kpm install` to generate one.");
  }

  // TODO: show and make user approve of updated packages from lockfile. analyse for changes.
  let lockfile = new Lockfile(null, false);
  let install = new Install("update", flags, args, config, reporter, lockfile);
  return install.init();
}
