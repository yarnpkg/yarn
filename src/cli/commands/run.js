/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {execCommand} from '../../util/execute-lifecycle-script.js';
import {MessageError} from '../../errors.js';
import {registries} from '../../resolvers/index.js';
import * as fs from '../../util/fs.js';
import map from '../../util/map.js';

const leven = require('leven');
const path = require('path');

function sanitizedArgs(args: Array<string>): Array<string> {
  const newArgs = [];
  for (let arg of args) {
    if (/\s/.test(arg)) {
      arg = `"${arg}"`;
    }
    newArgs.push(arg);
  }
  return newArgs;
}

export function setFlags() {}

export function hasWrapper(): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  // build up a list of possible scripts
  const pkg = await config.readManifest(config.cwd);
  const scripts = map();
  const binCommands = [];
  const visitedBinFolders = new Set();
  let pkgCommands = [];
  for (const registry of Object.keys(registries)) {
    const binFolder = path.join(config.cwd, config.registries[registry].folder, '.bin');
    if (!visitedBinFolders.has(binFolder)) {
      if (await fs.exists(binFolder)) {
        for (const name of await fs.readdir(binFolder)) {
          binCommands.push(name);
          scripts[name] = `"${path.join(binFolder, name)}"`;
        }
      }
      visitedBinFolders.add(binFolder);
    }
  }
  const pkgScripts = pkg.scripts;
  const cmdHints = {};
  if (pkgScripts) {
    // inherit `scripts` from manifest
    pkgCommands = Object.keys(pkgScripts).sort();

    // add command hints (what the actual yarn command will do)
    for (const cmd of pkgCommands) {
      cmdHints[cmd] = pkgScripts[cmd] || '';
    }

    Object.assign(scripts, pkg.scripts);
  }

  async function runCommand(args): Promise<void> {
    const action = args.shift();
    const actions = [`pre${action}`, action, `post${action}`];

    // build up list of commands
    const cmds = [];
    for (const action of actions) {
      const cmd = scripts[action];
      if (cmd) {
        cmds.push([action, cmd]);
      }
    }

    if (cmds.length) {
      // propagate YARN_SILENT env variable to executed commands
      process.env.YARN_SILENT = '1';
      for (const [stage, cmd] of cmds) {
        // only tack on trailing arguments for default script, ignore for pre and post - #1595
        const defaultScriptCmd = `${cmd} ${sanitizedArgs(args).join(' ')}`;
        const cmdWithArgs = stage === action ? defaultScriptCmd : cmd;
        await execCommand(stage, config, cmdWithArgs, config.cwd);
      }
    } else if (action === 'env') {
      reporter.info(`${JSON.stringify(process.env, null, 2)}`);
    } else {
      let suggestion;

      for (const commandName in scripts) {
        const steps = leven(commandName, action);
        if (steps < 2) {
          suggestion = commandName;
        }
      }

      let msg = `Command ${JSON.stringify(action)} not found.`;
      if (suggestion) {
        msg += ` Did you mean ${JSON.stringify(suggestion)}?`;
      }
      throw new MessageError(msg);
    }
  }

  // list possible scripts if none specified
  if (args.length === 0) {
    reporter.error(reporter.lang('commandNotSpecified'));
    reporter.info(`${reporter.lang('binCommands') + binCommands.join(', ')}`);
    reporter.info(`${reporter.lang('possibleCommands')}`);
    reporter.list('possibleCommands', pkgCommands, cmdHints);
    await reporter
      .question(reporter.lang('commandQuestion'))
      .then(answer => runCommand(answer.split(' ')), () => reporter.error(reporter.lang('commandNotSpecified')));
    return Promise.resolve();
  } else {
    return runCommand(args);
  }
}
