/* @flow */

import * as commands from './index.js';
import * as constants from '../../constants.js';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {sortAlpha, hyphenate, camelCase} from '../../util/misc.js';
const chalk = require('chalk');

export function hasWrapper(): boolean {
  return false;
}

export function run(
  config: Config,
  reporter: Reporter,
  commander: Object,
  args: Array<string>,
): Promise<void> {
  const getDocsLink = (name) => `${constants.YARN_DOCS}${name || ''}`;
  const getDocsInfo = (name) => 'Visit ' + chalk.bold(getDocsLink(name)) + ' for documentation about this command.';

  if (args.length) {
    const commandName = camelCase(args.shift());

    if (commandName) {
      const command = commands[commandName];

      if (command) {
        if (typeof command.setFlags === 'function') {
          command.setFlags(commander);
        }

        const examples: Array<string> = (command && command.examples) || [];
        if (examples.length) {
          commander.on('--help', () => {
            console.log('  Examples:\n');
            for (const example of examples) {
              console.log(`    $ yarn ${example}`);
            }
            console.log();
          });
        }
        commander.on('--help', () => console.log('  ' + getDocsInfo(commandName) + '\n'));

        commander.help();
        return Promise.resolve();
      }
    }
  }

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

  commander.help();
  return Promise.resolve();
}
