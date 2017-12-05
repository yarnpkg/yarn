/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {execCommand, makeEnv} from '../../util/execute-lifecycle-script.js';
import {MessageError} from '../../errors.js';
import {registries} from '../../resolvers/index.js';
import * as fs from '../../util/fs.js';
import map from '../../util/map.js';

const leven = require('leven');
const path = require('path');
const {quoteForShell, sh, unquoted} = require('puka');

export function setFlags(commander: Object) {}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
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
          //consider only .cmd scripts on Windows and show them without the extension - #624
          if (process.platform === 'win32') {
            if (name.match(/\.cmd$/) !== null) {
              const strippedName = name.slice(0, -4);
              binCommands.push(strippedName);
              scripts[name] = quoteForShell(path.join(binFolder, name));
            }
          } else {
            binCommands.push(name);
            scripts[name] = quoteForShell(path.join(binFolder, name));
          }
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

    Object.assign(scripts, pkgScripts);
  }

  async function runCommand(args): Promise<void> {
    const action = args.shift();

    // build up list of commands
    const cmds = [];

    if (pkgScripts && action in pkgScripts) {
      const preAction = `pre${action}`;
      if (preAction in pkgScripts) {
        cmds.push([preAction, pkgScripts[preAction]]);
      }

      cmds.push([action, scripts[action]]);

      const postAction = `post${action}`;
      if (postAction in pkgScripts) {
        cmds.push([postAction, pkgScripts[postAction]]);
      }
    } else if (scripts[action]) {
      cmds.push([action, scripts[action]]);
    } else if (process.platform === 'win32') {
      //Since input free of the .cmd extension was allowed, add it now - #624
      const cmdAction = action.concat('.cmd');
      if (scripts[cmdAction]) {
        cmds.push([cmdAction, scripts[cmdAction]]);
      }
    }

    if (cmds.length) {
      // Disable wrapper in executed commands
      process.env.YARN_WRAP_OUTPUT = 'false';
      for (const [stage, cmd] of cmds) {
        // only tack on trailing arguments for default script, ignore for pre and post - #1595
        const cmdWithArgs = stage === action ? sh`${unquoted(cmd)} ${args}` : cmd;
        await execCommand(stage, config, cmdWithArgs, config.cwd);
      }
    } else if (action === 'env') {
      reporter.log(JSON.stringify(await makeEnv('env', config.cwd, config), null, 2), {force: true});
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

    if (binCommands.length) {
      reporter.info(`${reporter.lang('binCommands') + binCommands.join(', ')}`);
    } else {
      reporter.error(reporter.lang('noBinAvailable'));
    }

    if (pkgCommands.length) {
      reporter.info(`${reporter.lang('possibleCommands')}`);
      reporter.list('possibleCommands', pkgCommands, cmdHints);
      await reporter
        .question(reporter.lang('commandQuestion'))
        .then(answer => runCommand(answer.split(' ')), () => reporter.error(reporter.lang('commandNotSpecified')));
    } else {
      reporter.error(reporter.lang('noScriptsAvailable'));
    }
    return Promise.resolve();
  } else {
    return runCommand(args);
  }
}
