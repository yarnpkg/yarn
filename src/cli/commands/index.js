/* @flow */

import * as runScript from "./run-script";
export { runScript };
import * as uninstall from "./uninstall";
export { uninstall };
import * as install from "./install";
export { install };
import * as update from "./update";
export { update };

import buildUseless from "./_useless";
export let lockfile = buildUseless("The lockfile command isn't necessary. `kpm install` will produce a lockfile.");
export let dedupe     = buildUseless("The dedupe command isn't necessary. `kpm install` will already dedupe.");
export let prune      = buildUseless("The prune command isn't necessary. `kpm install` will now automatically prune extraneous packages.");

import buildExecuteLifecycleScript from "./_execute-lifecycle-script";
export let restart = buildExecuteLifecycleScript("restart");
export let start   = buildExecuteLifecycleScript("start");
export let test    = buildExecuteLifecycleScript("test");
export let stop    = buildExecuteLifecycleScript("stop");
