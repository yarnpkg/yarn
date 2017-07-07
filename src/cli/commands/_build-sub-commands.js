/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import type {CLIFunction} from '../../types.js';
import {MessageError} from '../../errors.js';
import {camelCase, hyphenate} from '../../util/misc.js';

type SubCommands = {
  [commandName: string]: CLIFunction,
};

type Return = {
  run: CLIFunction,
  setFlags: (commander: Object) => void,
  hasWrapper: (commander: Object, Array<string>) => boolean,
  examples: Array<string>,
};

type Usage = Array<string>;

export default function(rootCommandName: string, subCommands: SubCommands, usage?: Usage = []): Return {
  const subCommandNames = Object.keys(subCommands).map(hyphenate);

  function setFlags(commander: Object) {
    commander.usage(`${rootCommandName} [${subCommandNames.join('|')}] [flags]`);
  }

  async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    const subName: ?string = camelCase(args.shift() || '');
    if (subName && subCommands[subName]) {
      const command: CLIFunction = subCommands[subName];
      const res = await command(config, reporter, flags, args);
      if (res !== false) {
        return Promise.resolve();
      }
    }

    if (usage && usage.length) {
      reporter.error(`${reporter.lang('usage')}:`);
      for (const msg of usage) {
        reporter.error(`yarn ${rootCommandName} ${msg}`);
      }
    }
    return Promise.reject(new MessageError(reporter.lang('invalidCommand', subCommandNames.join(', '))));
  }

  function hasWrapper(commander: Object, args: Array<string>): boolean {
    return true;
  }

  const examples = usage.map((cmd: string): string => {
    return `${rootCommandName} ${cmd}`;
  });

  return {run, setFlags, hasWrapper, examples};
}
