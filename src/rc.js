/* @flow */

import {dirname, resolve} from 'path';
import parse from './lockfile/parse.js';
import * as rcUtil from './util/rc.js';

// Keys that will get resolved relative to the path of the rc file they belong to
const PATH_KEYS = ['cache-folder', 'global-folder', 'modules-folder', 'cwd'];

// given a cwd, load all .yarnrc files relative to it
function getRcConfigForCwd(cwd: string): {[key: string]: string} {
  return rcUtil.findRc('yarn', cwd, (fileText, filePath) => {
    const {object: values} = parse(fileText, 'yarnrc');

    // some keys reference directories so keep their relativity
    for (const key in values) {
      for (const pathKey of PATH_KEYS) {
        if (key.replace(/^(--)?([^.]+\.)*/, '') === pathKey) {
          values[key] = resolve(dirname(filePath), values[key]);
        }
      }
    }

    return values;
  });
}

// get the built of arguments of a .yarnrc chain of the passed cwd
function buildRcArgs(cwd: string): Map<string, Array<string>> {
  const config = getRcConfigForCwd(cwd);

  const argsForCommands: Map<string, Array<string>> = new Map();

  for (const key in config) {
    // args can be prefixed with the command name they're meant for, eg.
    // `--install.check-files true`
    const keyMatch = key.match(/^--(?:([^.]+)\.)?(.*)$/);
    if (!keyMatch) {
      continue;
    }

    const commandName = keyMatch[1] || '*';
    const arg = keyMatch[2];
    const value = config[key];

    // create args for this command name if we didn't previously have them
    const args = argsForCommands.get(commandName) || [];
    argsForCommands.set(commandName, args);

    // turn config value into appropriate cli flag
    if (typeof value === 'string') {
      args.push(`--${arg}`, value);
    } else if (value === true) {
      args.push(`--${arg}`);
    } else if (value === false) {
      args.push(`--no-${arg}`);
    }
  }

  return argsForCommands;
}

// extract the value of a --cwd arg if present
function extractCwdArg(args: Array<string>): ?string {
  for (let i = 0, I = args.length; i < I; ++i) {
    const arg = args[i];
    if (arg === '--') {
      return null;
    } else if (arg === '--cwd') {
      return args[i + 1];
    }
  }
  return null;
}

// get a list of arguments from .yarnrc that apply to this commandName
export function getRcArgs(commandName: string, args: Array<string>, previousCwds?: Array<string> = []): Array<string> {
  // for the cwd, use the --cwd arg if it was passed or else use process.cwd()
  const origCwd = extractCwdArg(args) || process.cwd();

  // get a map of command names and their arguments
  const argMap = buildRcArgs(origCwd);

  // concat wildcard arguments and arguments meant for this specific command
  const newArgs = [].concat(argMap.get('*') || [], argMap.get(commandName) || []);

  // check if the .yarnrc args specified a cwd
  const newCwd = extractCwdArg(newArgs);
  if (newCwd && newCwd !== origCwd) {
    // ensure that we don't enter into a loop
    if (previousCwds.indexOf(newCwd) !== -1) {
      throw new Error(`Recursive .yarnrc files specifying --cwd flags. Bailing out.`);
    }

    //  if we have a new cwd then let's refetch the .yarnrc args relative to it
    return getRcArgs(commandName, newArgs, previousCwds.concat(origCwd));
  }

  return newArgs;
}
