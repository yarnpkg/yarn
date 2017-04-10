/* @flow */
import {ConsoleReporter, JSONReporter} from '../../reporters/index.js';
import * as constants from '../../constants.js';
import {MessageError} from '../../errors.js';
import Config from '../../config.js';

const chalk = require('chalk');

const getDocsLink = (name) => `${constants.YARN_DOCS}${name || ''}`;
const getDocsInfo = (name) => 'Visit ' + chalk.bold(getDocsLink(name)) + ' for documentation about this command.';

const commands = {};

import * as access from './access.js'; commands['access'] = access;
import * as add from './add.js'; commands['add'] = add;
import * as bin from './bin.js'; commands['bin'] = bin;
import * as cache from './cache.js'; commands['cache'] = cache;
import * as check from './check.js'; commands['check'] = check;
import * as clean from './clean.js'; commands['clean'] = clean;
import * as config from './config.js'; commands['config'] = config;
import * as generateLockEntry from './generate-lock-entry.js'; commands['generateLockEntry'] = generateLockEntry;
import * as global from './global.js'; commands['global'] = global;
import * as help from './help.js'; commands['help'] = help;
import * as import_ from './import.js'; commands['import'] = import_;
import * as info from './info.js'; commands['info'] = info;
import * as init from './init.js'; commands['init'] = init;
import * as install from './install.js'; commands['install'] = install;
import * as licenses from './licenses.js'; commands['licenses'] = licenses;
import * as link from './link.js'; commands['link'] = link;
import * as login from './login.js'; commands['login'] = login;
import * as logout from './logout.js'; commands['logout'] = logout;
import * as list from './list.js'; commands['list'] = list;
import * as outdated from './outdated.js'; commands['outdated'] = outdated;
import * as owner from './owner.js'; commands['owner'] = owner;
import * as pack from './pack.js'; commands['pack'] = pack;
import * as publish from './publish.js'; commands['publish'] = publish;
import * as remove from './remove.js'; commands['remove'] = remove;
import * as run from './run.js'; commands['run'] = run;
import * as tag from './tag.js'; commands['tag'] = tag;
import * as team from './team.js'; commands['team'] = team;
import * as unlink from './unlink.js'; commands['unlink'] = unlink;
import * as upgrade from './upgrade.js'; commands['upgrade'] = upgrade;
import * as version from './version.js'; commands['version'] = version;
import * as versions from './versions.js'; commands['versions'] = versions;
import * as why from './why.js'; commands['why'] = why;
import * as upgradeInteractive from './upgrade-interactive.js'; commands['upgradeInteractive'] = upgradeInteractive;

import buildUseless from './_useless.js';

commands['lockfile'] = buildUseless(
  "The lockfile command isn't necessary. `yarn install` will produce a lockfile.",
);

commands['dedupe'] = buildUseless(
  "The dedupe command isn't necessary. `yarn install` will already dedupe.",
);

commands['prune'] = buildUseless(
  "The prune command isn't necessary. `yarn install` will prune extraneous packages.",
);

for (const key in commands) {
  commands[key].getDocsInfo = getDocsInfo(key);
}

import aliases from '../aliases.js';

for (const key in aliases) {
  commands[key] = commands[aliases[key]];
  commands[key].getDocsInfo = getDocsInfo(key);
}

import unsupportedAliases from '../unsupported-aliases.js';

for (const key in unsupportedAliases) {
  commands[key] = {
    run(config: Config, reporter: ConsoleReporter | JSONReporter): Promise<void> {
      throw new MessageError(`Did you mean \`yarn ${unsupportedAliases[key]}\`?`);
    },
    setFlags: () => {},
    hasWrapper: () => true,
    getDocsInfo: getDocsInfo(unsupportedAliases[key]),
  };
}

export default ({
  ...commands,
}: { [key: string]: Object });
