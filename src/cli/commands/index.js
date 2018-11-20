/* @flow */
import * as constants from '../../constants.js';

const chalk = require('chalk');

const getDocsLink = name => `${constants.YARN_DOCS}${name || ''}`;
const getDocsInfo = name => 'Visit ' + chalk.bold(getDocsLink(name)) + ' for documentation about this command.';

import * as access from './access.js';
import * as add from './add.js';
import * as audit from './audit.js';
import * as autoclean from './autoclean.js';
import * as bin from './bin.js';
import * as cache from './cache.js';
import * as check from './check.js';
import * as config from './config.js';
import * as create from './create.js';
import * as exec from './exec.js';
import * as generateLockEntry from './generate-lock-entry.js';
import * as global from './global.js';
import * as help from './help.js';
import * as import_ from './import.js';
import * as info from './info.js';
import * as init from './init.js';
import * as install from './install.js';
import * as licenses from './licenses.js';
import * as link from './link.js';
import * as login from './login.js';
import * as logout from './logout.js';
import * as list from './list.js';
import * as node from './node.js';
import * as outdated from './outdated.js';
import * as owner from './owner.js';
import * as pack from './pack.js';
import * as policies from './policies.js';
import * as publish from './publish.js';
import * as remove from './remove.js';
import * as run from './run.js';
import * as tag from './tag.js';
import * as team from './team.js';
import * as unplug from './unplug.js';
import * as unlink from './unlink.js';
import * as upgrade from './upgrade.js';
import * as version from './version.js';
import * as versions from './versions.js';
import * as why from './why.js';
import * as workspaces from './workspaces.js';
import * as workspace from './workspace.js';
import * as upgradeInteractive from './upgrade-interactive.js';

import buildUseless from './_useless.js';

const commands = {
  access,
  add,
  audit,
  autoclean,
  bin,
  cache,
  check,
  config,
  create,
  dedupe: buildUseless("The dedupe command isn't necessary. `yarn install` will already dedupe."),
  exec,
  generateLockEntry,
  global,
  help,
  import: import_,
  info,
  init,
  install,
  licenses,
  link,
  lockfile: buildUseless("The lockfile command isn't necessary. `yarn install` will produce a lockfile."),
  login,
  logout,
  list,
  node,
  outdated,
  owner,
  pack,
  policies,
  prune: buildUseless("The prune command isn't necessary. `yarn install` will prune extraneous packages."),
  publish,
  remove,
  run,
  tag,
  team,
  unplug,
  unlink,
  upgrade,
  version,
  versions,
  why,
  workspaces,
  workspace,
  upgradeInteractive,
};

for (const key in commands) {
  commands[key].getDocsInfo = getDocsInfo(key);
}

import aliases from '../aliases.js';

for (const key in aliases) {
  commands[key] = commands[aliases[key]];
  commands[key].getDocsInfo = getDocsInfo(key);
}

export default commands;
