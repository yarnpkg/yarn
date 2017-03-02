/* @flow */

import * as commands from './index.js';
import * as constants from '../../constants.js';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {sortAlpha, hyphenate} from '../../util/misc.js';
const chalk = require('chalk');

export function run(
  config: Config,
  reporter: Reporter,
  commander: Object,
  args: Array<string>,
): Promise<void> {
  const getDocsLink = (name) => `${constants.YARN_DOCS}${name || ''}`;
  const getDocsInfo = (name) => 'Visit ' + chalk.bold(getDocsLink(name)) + ' for documentation about this command.';

  if (args.length) {
    const helpCommand = hyphenate(args[0]);
    if (commands[helpCommand]) {
      commander.on('--help', () => console.log('  ' + getDocsInfo(helpCommand) + '\n'));
    }
  } else {
    commander.on('--help', () => {
      console.log('  Commands:\n');
      for (const name of Object.keys(commands).sort(sortAlpha)) {
        if (commands[name].useless) {
          continue;
        }

        console.log(`    - ${hyphenate(name)}`);
      }
      console.log('\n  Run `' + chalk.bold('yarn help COMMAND') + '` for more information on specific commands.');
      console.log('  Visit ' + chalk.bold(getDocsLink()) + ' to learn more about Yarn.\n');
    });
  }
  commander.help();
  return Promise.resolve();
}
