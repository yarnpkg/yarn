/* @flow */

import commands from './index.js';
import * as constants from '../../constants.js';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {sortAlpha, sortOptionsByFlags, hyphenate} from '../../util/misc.js';
import aliases from '../aliases';
const chalk = require('chalk');

export function hasWrapper(flags: Object, args: Array<string>): boolean {
  return false;
}

export function setFlags(commander: Object) {
  commander.description('Displays help information.');
}

export function run(config: Config, reporter: Reporter, commander: Object, args: Array<string>): Promise<void> {
  if (args.length) {
    const commandName = args.shift();
    if (Object.prototype.hasOwnProperty.call(commands, commandName)) {
      const command = commands[commandName];
      if (command) {
        command.setFlags(commander);
        const examples: Array<string> = (command.examples || []).map(example => `    $ yarn ${example}`);
        if (examples.length) {
          commander.on('--help', () => {
            reporter.log(reporter.lang('helpExamples', reporter.rawText(examples.join('\n'))));
          });
        }
        // eslint-disable-next-line yarn-internal/warn-language
        commander.on('--help', () => reporter.log('  ' + command.getDocsInfo + '\n'));
        commander.help();
        return Promise.resolve();
      }
    }
  }

  commander.on('--help', () => {
    const commandsText = [];
    for (const name of Object.keys(commands).sort(sortAlpha)) {
      if (commands[name].useless || Object.keys(aliases).map(key => aliases[key]).indexOf(name) > -1) {
        continue;
      }
      if (aliases[name]) {
        commandsText.push(`    - ${hyphenate(name)} / ${aliases[name]}`);
      } else {
        commandsText.push(`    - ${hyphenate(name)}`);
      }
    }
    reporter.log(reporter.lang('helpCommands', reporter.rawText(commandsText.join('\n'))));
    reporter.log(reporter.lang('helpCommandsMore', reporter.rawText(chalk.bold('yarn help COMMAND'))));
    reporter.log(reporter.lang('helpLearnMore', reporter.rawText(chalk.bold(constants.YARN_DOCS))));
  });

  commander.options.sort(sortOptionsByFlags);

  commander.help();
  return Promise.resolve();
}
