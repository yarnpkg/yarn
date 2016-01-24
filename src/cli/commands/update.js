/* @flow */

import type Reporter from "../../reporters/_base";
import type Config from "../../config";
import { Install } from "./install";
import Lockfile from "../../lockfile";
import { MessageError } from "../../errors";
import * as constants from "../../constants";
import * as fs from "../../util/fs";

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
