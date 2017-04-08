/* @flow */

import BaseCommand from './_base.js';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import type {CLIFunction} from '../../types.js';
import {MessageError} from '../../errors.js';
import {camelCase, hyphenate} from '../../util/misc.js';

type SubCommands =  {
  [commandName: string]: CLIFunction,
};

type Usage = Array<string>;

export default class SubCommand extends BaseCommand {
  rootCommandName: string;
  subCommands: SubCommands;
  subCommandNames: Array<string>;
  usage: Usage;
  examples: Array<string>;

  constructor(rootCommandName: string, subCommands: SubCommands, usage?: Usage = []) {
    super();
    this.rootCommandName = rootCommandName;
    this.subCommands = subCommands;
    this.subCommandNames = Object.keys(subCommands).map(hyphenate);
    this.usage = usage;
    this.examples = usage.map((cmd: string): string => {
      return `${rootCommandName} ${cmd}`;
    });
  }

  setFlags(commander: Object) {
    commander.usage(`${this.rootCommandName} [${this.subCommandNames.join('|')}] [flags]`);
  }

  async run(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    const subName: ?string = camelCase(args.shift() || '');
    if (subName && this.subCommands[subName]) {
      const command: CLIFunction = this.subCommands[subName];
      const res = await command(config, reporter, flags, args);
      if (res !== false) {
        return Promise.resolve();
      }
    }

    if (this.usage && this.usage.length) {
      reporter.error(`${reporter.lang('usage')}:`);
      for (const msg of this.usage) {
        reporter.error(`yarn ${this.rootCommandName} ${msg}`);
      }
    }
    return Promise.reject(new MessageError(reporter.lang('invalidCommand', this.subCommandNames.join(', '))));
  }
}
