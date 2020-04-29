/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {execCommand, makeEnv} from '../../util/execute-lifecycle-script.js';
import {dynamicRequire} from '../../util/dynamic-require.js';
import {callThroughHook} from '../../util/hooks.js';
import {MessageError} from '../../errors.js';
import {checkOne as checkCompatibility} from '../../package-compatibility.js';
import * as fs from '../../util/fs.js';
import * as constants from '../../constants.js';

const invariant = require('invariant');
const leven = require('leven');
const path = require('path');
const {quoteForShell, sh, unquoted} = require('puka');

function toObject(input: Map<string, string>): Object {
  const output = Object.create(null);

  for (const [key, val] of input.entries()) {
    output[key] = val;
  }

  return output;
}

export async function getBinEntries(config: Config): Promise<Map<string, string>> {
  const binFolders = new Set();
  const binEntries = new Map();

  // Setup the node_modules/.bin folders for analysis
  for (const registryFolder of config.registryFolders) {
    binFolders.add(path.resolve(config.cwd, registryFolder, '.bin'));
    binFolders.add(path.resolve(config.lockfileFolder, registryFolder, '.bin'));
  }

  // Same thing, but for the pnp dependencies, located inside the cache
  if (await fs.exists(`${config.lockfileFolder}/${constants.PNP_FILENAME}`)) {
    const pnpApi = dynamicRequire(`${config.lockfileFolder}/${constants.PNP_FILENAME}`);

    const packageLocator = pnpApi.findPackageLocator(`${config.cwd}/`);
    const packageInformation = pnpApi.getPackageInformation(packageLocator);

    for (const [name, reference] of packageInformation.packageDependencies.entries()) {
      const dependencyInformation = pnpApi.getPackageInformation({name, reference});

      if (dependencyInformation.packageLocation) {
        binFolders.add(`${dependencyInformation.packageLocation}/.bin`);
      }
    }
  }

  // Build up a list of possible scripts by exploring the folders marked for analysis
  for (const binFolder of binFolders) {
    if (await fs.exists(binFolder)) {
      for (const name of await fs.readdir(binFolder)) {
        binEntries.set(name, path.join(binFolder, name));
      }
    }
  }

  return binEntries;
}

export function setFlags(commander: Object) {
  commander.description('Runs a defined package script.');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const pkg = await config.readManifest(config.cwd);

  const binCommands = new Set();
  const pkgCommands = new Set();

  const scripts: Map<string, string> = new Map();

  for (const [name, loc] of await getBinEntries(config)) {
    scripts.set(name, quoteForShell(loc));
    binCommands.add(name);
  }

  const pkgScripts = pkg.scripts;

  if (pkgScripts) {
    for (const name of Object.keys(pkgScripts).sort()) {
      scripts.set(name, pkgScripts[name] || '');
      pkgCommands.add(name);
    }
  }

  function runCommand([action, ...args]): Promise<void> {
    return callThroughHook('runScript', () => realRunCommand(action, args), {action, args});
  }

  async function realRunCommand(action, args): Promise<void> {
    // build up list of commands
    const cmds = [];

    if (pkgScripts && action in pkgScripts) {
      const preAction = `pre${action}`;
      if (preAction in pkgScripts) {
        cmds.push([preAction, pkgScripts[preAction]]);
      }

      const script = scripts.get(action);
      invariant(script, 'Script must exist');
      cmds.push([action, script]);

      const postAction = `post${action}`;
      if (postAction in pkgScripts) {
        cmds.push([postAction, pkgScripts[postAction]]);
      }
    } else if (scripts.has(action)) {
      const script = scripts.get(action);
      invariant(script, 'Script must exist');
      cmds.push([action, script]);
    }

    if (cmds.length) {
      const ignoreEngines = !!(flags.ignoreEngines || config.getOption('ignore-engines'));
      try {
        await checkCompatibility(pkg, config, ignoreEngines);
      } catch (err) {
        throw err instanceof MessageError ? new MessageError(reporter.lang('cannotRunWithIncompatibleEnv')) : err;
      }

      // Disable wrapper in executed commands
      process.env.YARN_WRAP_OUTPUT = 'false';
      for (const [stage, cmd] of cmds) {
        // only tack on trailing arguments for default script, ignore for pre and post - #1595
        const cmdWithArgs = stage === action ? sh`${unquoted(cmd)} ${args}` : cmd;
        const customShell = config.getOption('script-shell');
        await execCommand({
          stage,
          config,
          cmd: cmdWithArgs,
          cwd: flags.into || config.cwd,
          isInteractive: true,
          customShell: customShell ? String(customShell) : undefined,
        });
      }
    } else if (action === 'env') {
      reporter.log(JSON.stringify(await makeEnv('env', config.cwd, config), null, 2), {force: true});
    } else {
      let suggestion;

      for (const commandName of scripts.keys()) {
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
    if (binCommands.size > 0) {
      reporter.info(`${reporter.lang('binCommands') + Array.from(binCommands).join(', ')}`);
    } else {
      reporter.error(reporter.lang('noBinAvailable'));
    }

    const printedCommands: Map<string, string> = new Map();

    for (const pkgCommand of pkgCommands) {
      const action = scripts.get(pkgCommand);
      invariant(action, 'Action must exists');
      printedCommands.set(pkgCommand, action);
    }

    if (pkgCommands.size > 0) {
      reporter.info(`${reporter.lang('possibleCommands')}`);
      reporter.list('possibleCommands', Array.from(pkgCommands), toObject(printedCommands));
      if (!flags.nonInteractive) {
        await reporter
          .question(reporter.lang('commandQuestion'))
          .then(
            answer => runCommand(answer.trim().split(' ')),
            () => reporter.error(reporter.lang('commandNotSpecified')),
          );
      }
    } else {
      reporter.error(reporter.lang('noScriptsAvailable'));
    }
    return Promise.resolve();
  } else {
    return runCommand(args);
  }
}
