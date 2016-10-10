/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import type {CLIFunction} from '../../types.js';
import {MessageError} from '../../errors.js';

const camelCase = require('camelcase');

type SubCommands =  {
  [commandName: string]: CLIFunction,
};

type Return = {
  run: CLIFunction,
  setFlags: (commander: Object) => void,
  examples: Array<string>,
};

type Usage = Array<string>;

export default function(rootCommandName: string, subCommands: SubCommands, usage?: Usage = []): Return {
  const subCommandNames = Object.keys(subCommands);

  function setFlags(commander: Object) {
    commander.usage(`${rootCommandName} [${subCommandNames.join('|')}] [flags]`);
  }

  async function run(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    const subName = camelCase(args.shift() || '');
    const isValidCommand = subName && subCommandNames.indexOf(subName) >= 0;
    if (isValidCommand) {
      const command: CLIFunction = subCommands[subName];
      const res = await command(config, reporter, flags, args);
      if (res !== false) {
        return Promise.resolve();
      }
    }

    reporter.error(`${reporter.lang('usage')}:`);
    for (const msg of usage) {
      reporter.error(`yarn ${rootCommandName} ${msg}`);
    }
    return Promise.reject(new MessageError('Invalid arguments.'));
  }

  const examples = usage.map((cmd: string): string => {
    return `${rootCommandName} ${cmd}`;
  });

  return {run, setFlags, examples};
}
