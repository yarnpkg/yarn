/* @flow */

import type {ReporterSpinner} from '../reporters/types.js';
import type Config from '../config.js';
import {MessageError, SpawnError} from '../errors.js';
import * as constants from '../constants.js';
import * as child from './child.js';
import {exists} from './fs.js';
import {registries} from '../resolvers/index.js';
import {fixCmdWinSlashes} from './fix-cmd-win-slashes.js';
import {run as globalRun, getBinFolder as getGlobalBinFolder} from '../cli/commands/global.js';

const invariant = require('invariant');
const path = require('path');

export type LifecycleReturn = Promise<{
  cwd: string,
  command: string,
  stdout: string,
}>;

const IGNORE_MANIFEST_KEYS = ['readme'];

// We treat these configs as internal, thus not expose them to process.env.
// This helps us avoid some gyp issues when building native modules.
// See https://github.com/yarnpkg/yarn/issues/2286.
const IGNORE_CONFIG_KEYS = ['lastUpdateCheck'];

export async function makeEnv(
  stage: string,
  cwd: string,
  config: Config,
): {
  [key: string]: string,
} {
  const env = Object.assign({}, process.env);

  // Merge in the `env` object specified in .yarnrc
  const customEnv = config.getOption('env');
  if (customEnv && typeof customEnv === 'object') {
    Object.assign(env, customEnv);
  }

  env.npm_lifecycle_event = stage;
  env.npm_node_execpath = env.NODE || process.execPath;
  env.npm_execpath = env.npm_execpath || process.mainModule.filename;

  // Set the env to production for npm compat if production mode.
  // https://github.com/npm/npm/blob/30d75e738b9cb7a6a3f9b50e971adcbe63458ed3/lib/utils/lifecycle.js#L336
  if (config.production) {
    env.NODE_ENV = 'production';
  }

  // Note: npm_config_argv environment variable contains output of nopt - command-line
  // parser used by npm. Since we use other parser, we just roughly emulate it's output. (See: #684)
  env.npm_config_argv = JSON.stringify({
    remain: [],
    cooked: [config.commandName],
    original: [config.commandName],
  });

  // add npm_package_*
  const manifest = await config.maybeReadManifest(cwd);
  if (manifest) {
    const queue = [['', manifest]];
    while (queue.length) {
      const [key, val] = queue.pop();
      if (key[0] === '_') {
        continue;
      }

      if (typeof val === 'object') {
        for (const subKey in val) {
          const completeKey = [key, subKey].filter((part: ?string): boolean => !!part).join('_');
          queue.push([completeKey, val[subKey]]);
        }
      } else if (IGNORE_MANIFEST_KEYS.indexOf(key) < 0) {
        let cleanVal = String(val);
        if (cleanVal.indexOf('\n') >= 0) {
          cleanVal = JSON.stringify(cleanVal);
        }

        //replacing invalid chars with underscore
        const cleanKey = key.replace(/[^a-zA-Z0-9_]/g, '_');

        env[`npm_package_${cleanKey}`] = cleanVal;
      }
    }
  }

  // add npm_config_*
  const keys: Set<string> = new Set([
    ...Object.keys(config.registries.yarn.config),
    ...Object.keys(config.registries.npm.config),
  ]);
  for (const key of keys) {
    if (key.match(/:_/) || IGNORE_CONFIG_KEYS.indexOf(key) >= 0) {
      continue;
    }

    let val = config.getOption(key);

    if (!val) {
      val = '';
    } else if (typeof val === 'number') {
      val = '' + val;
    } else if (typeof val !== 'string') {
      val = JSON.stringify(val);
    }

    if (val.indexOf('\n') >= 0) {
      val = JSON.stringify(val);
    }

    const cleanKey = key.replace(/^_+/, '');
    const envKey = `npm_config_${cleanKey}`.replace(/[^a-zA-Z0-9_]/g, '_');
    env[envKey] = val;
  }

  return env;
}

export async function executeLifecycleScript(
  stage: string,
  config: Config,
  cwd: string,
  cmd: string,
  spinner?: ReporterSpinner,
): LifecycleReturn {
  // if we don't have a spinner then pipe everything to the terminal
  const stdio = spinner ? undefined : 'inherit';

  const env = await makeEnv(stage, cwd, config);

  // split up the path
  const pathParts = (env[constants.ENV_PATH_KEY] || '').split(path.delimiter);

  // Include node-gyp version that was bundled with the current Node.js version,
  // if available.
  pathParts.unshift(path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'node-gyp-bin'));
  pathParts.unshift(
    path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'node-gyp-bin'),
  );

  // Add global bin folder if it is not present already, as some packages depend
  // on a globally-installed version of node-gyp.
  const globalBin = getGlobalBinFolder(config, {});
  if (pathParts.indexOf(globalBin) === -1) {
    pathParts.unshift(globalBin);
  }

  // add .bin folders to PATH
  for (const registry of Object.keys(registries)) {
    const binFolder = path.join(config.registries[registry].folder, '.bin');
    pathParts.unshift(path.join(config.linkFolder, binFolder));
    pathParts.unshift(path.join(cwd, binFolder));
  }

  await checkForGypIfNeeded(config, cmd, pathParts);

  if (config.scriptsPrependNodePath) {
    pathParts.unshift(path.join(path.dirname(process.execPath)));
  }

  // join path back together
  env[constants.ENV_PATH_KEY] = pathParts.join(path.delimiter);

  // get shell
  const conf = {windowsVerbatimArguments: false};
  let sh = 'sh';
  let shFlag = '-c';
  if (process.platform === 'win32') {
    // cmd or command.com
    sh = process.env.comspec || 'cmd';

    // d - Ignore registry AutoRun commands
    // s - Strip " quote characters from command.
    // c - Run Command and then terminate
    shFlag = '/d /s /c';

    // handle windows run scripts starting with a relative path
    cmd = fixCmdWinSlashes(cmd);

    // handle quotes properly in windows environments - https://github.com/nodejs/node/issues/5060
    conf.windowsVerbatimArguments = true;
  }

  let updateProgress;
  if (spinner) {
    updateProgress = data => {
      const dataStr = data
        .toString() // turn buffer into string
        .trim(); // trim whitespace

      invariant(spinner && spinner.tick, 'We should have spinner and its ticker here');
      if (dataStr) {
        spinner.tick(
          dataStr
            // Only get the last line
            .substr(dataStr.lastIndexOf('\n') + 1)
            // change tabs to spaces as they can interfere with the console
            .replace(/\t/g, ' '),
        );
      }
    };
  }
  const stdout = await child.spawn(sh, [shFlag, cmd], {cwd, env, stdio, ...conf}, updateProgress);

  return {cwd, command: cmd, stdout};
}

export default executeLifecycleScript;

let checkGypPromise: ?Promise<void> = null;
/**
 * Special case: Some packages depend on node-gyp, but don't specify this in
 * their package.json dependencies. They assume that node-gyp is available
 * globally. We need to detect this case and show an error message.
 */
function checkForGypIfNeeded(config: Config, cmd: string, paths: Array<string>): Promise<void> {
  if (cmd.substr(0, cmd.indexOf(' ')) !== 'node-gyp') {
    return Promise.resolve();
  }

  // Ensure this only runs once, rather than multiple times in parallel.
  if (!checkGypPromise) {
    checkGypPromise = _checkForGyp(config, paths);
  }
  return checkGypPromise;
}

async function _checkForGyp(config: Config, paths: Array<string>): Promise<void> {
  const {reporter} = config;

  // Check every directory in the PATH
  const allChecks = await Promise.all(paths.map(dir => exists(path.join(dir, 'node-gyp'))));
  if (allChecks.some(Boolean)) {
    // node-gyp is available somewhere
    return;
  }

  reporter.info(reporter.lang('packageRequiresNodeGyp'));

  try {
    await globalRun(config, reporter, {}, ['add', 'node-gyp']);
  } catch (e) {
    throw new MessageError(reporter.lang('nodeGypAutoInstallFailed', e.message));
  }
}

export async function execFromManifest(config: Config, commandName: string, cwd: string): Promise<void> {
  const pkg = await config.maybeReadManifest(cwd);
  if (!pkg || !pkg.scripts) {
    return;
  }

  const cmd: ?string = pkg.scripts[commandName];
  if (cmd) {
    await execCommand(commandName, config, cmd, cwd);
  }
}

export async function execCommand(stage: string, config: Config, cmd: string, cwd: string): Promise<void> {
  const {reporter} = config;
  try {
    reporter.command(cmd);
    await executeLifecycleScript(stage, config, cwd, cmd);
    return Promise.resolve();
  } catch (err) {
    if (err instanceof SpawnError) {
      throw new MessageError(reporter.lang('commandFailed', err.EXIT_CODE));
    } else {
      throw err;
    }
  }
}
