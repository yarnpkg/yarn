/* @flow */

import path from 'path';

import * as child from '../child.js';

const BATCH_MODE_ARGS = {
  ssh: '-oBatchMode=yes',
  plink: '-batch',
};

// Suppress any password prompts since we run these in the background
const env = {
  GIT_ASKPASS: '',
  GIT_TERMINAL_PROMPT: 0,
  ...process.env,
};

const sshCommand = env.GIT_SSH || 'ssh';
const sshExecutable = path.basename(sshCommand, '.exe');
const sshBatchArgs = BATCH_MODE_ARGS[sshExecutable];

if (!env.GIT_SSH_COMMAND && sshBatchArgs) {
  env.GIT_SSH_COMMAND = `${sshCommand} ${sshBatchArgs}`;
}

export const spawn = (args: Array<string>, opts?: child_process$spawnOpts = {}): Promise<string> => {
  return child.spawn('git', args, {...opts, env});
};
