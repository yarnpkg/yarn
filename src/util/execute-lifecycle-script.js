/* @flow */

import type Config from '../config.js';
import * as constants from '../constants.js';
import * as child from './child.js';
import {registries} from '../resolvers/index.js';
import type {ReporterSpinner} from '../reporters/types.js';

const path = require('path');

export type LifecycleReturn = Promise<{
  cwd: string,
  command: string,
  stdout: string,
}>;

function makeEnv(stage: string): {
  [key: string]: string
} {
  const env = Object.assign({}, process.env);

  env.npm_lifecycle_event = stage;
  env.npm_node_execpath = env.NODE || process.execPath;
  env.npm_execpath = path.join(__dirname, '..', '..', 'bin', 'yarn.js');

  return env;
}

export default async function (
  stage: string,
  config: Config,
  cwd: string,
  cmd: string,
  spinner?: ReporterSpinner,
): LifecycleReturn {
  // if we don't have a spinner then pipe everything to the terminal
  const stdio = spinner ? undefined : 'inherit';

  const env = makeEnv(stage);

  // split up the path
  const pathParts = (env[constants.ENV_PATH_KEY] || '').split(path.delimiter);

  // add node-gyp
  pathParts.unshift(path.join(__dirname, '..', '..', 'bin', 'node-gyp-bin'));

  // add .bin folders to PATH
  for (const registry of Object.keys(registries)) {
    pathParts.unshift(path.join(cwd, config.registries[registry].folder, '.bin'));
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

    // handle quotes properly in windows environments - https://github.com/nodejs/node/issues/5060
    conf.windowsVerbatimArguments = true;
  }

  const stdout = await child.spawn(sh, [shFlag, cmd], {cwd, env, stdio, ...conf}, (data) => {
    if (spinner) {
      const line = data.toString() // turn buffer into string
        .trim() // trim whitespace
        .split('\n') // split into lines
        .pop() // use only the last line
        .replace(/\t/g, ' '); // change tabs to spaces as they can interfere with the console

      if (line) {
        spinner.tick(line);
      }
    }
  });

  return {cwd, command: cmd, stdout};
}
