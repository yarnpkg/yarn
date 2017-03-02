/* @flow */

import * as access from './access.js'; export {access};
import * as add from './add.js'; export {add};
import * as bin from './bin.js'; export {bin};
import * as cache from './cache.js'; export {cache};
import * as check from './check.js'; export {check};
import * as clean from './clean.js'; export {clean};
import * as config from './config.js'; export {config};
import * as generateLockEntry from './generate-lock-entry.js'; export {generateLockEntry};
import * as global from './global.js'; export {global};
import * as help from './help.js'; export {help};
import * as import_ from './import.js'; export {import_ as import};
import * as info from './info.js'; export {info};
import * as init from './init.js'; export {init};
import * as install from './install.js'; export {install};
import * as licenses from './licenses.js'; export {licenses};
import * as link from './link.js'; export {link};
import * as login from './login.js'; export {login};
import * as logout from './logout.js'; export {logout};
import * as list from './list.js'; export {list};
import * as outdated from './outdated.js'; export {outdated};
import * as owner from './owner.js'; export {owner};
import * as pack from './pack.js'; export {pack};
import * as publish from './publish.js'; export {publish};
import * as remove from './remove.js'; export {remove};
import * as run from './run.js'; export {run};
import * as tag from './tag.js'; export {tag};
import * as team from './team.js'; export {team};
import * as unlink from './unlink.js'; export {unlink};
import * as upgrade from './upgrade.js'; export {upgrade};
import * as version from './version.js'; export {version};
import * as versions from './versions.js'; export {versions};
import * as why from './why.js'; export {why};
import * as upgradeInteractive from './upgrade-interactive.js'; export {upgradeInteractive};

import buildUseless from './_useless.js';

export const lockfile = buildUseless(
  "The lockfile command isn't necessary. `yarn install` will produce a lockfile.",
);

export const dedupe = buildUseless(
  "The dedupe command isn't necessary. `yarn install` will already dedupe.",
);

export const prune = buildUseless(
  "The prune command isn't necessary. `yarn install` will prune extraneous packages.",
);
