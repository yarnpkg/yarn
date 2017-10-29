/* @flow */

import path from 'path';

import * as child from '../child.js';

const BATCH_MODE_ARGS = new Map([['ssh', '-oBatchMode=yes'], ['plink', '-batch']]);
const WRAPPER_PATHS = new Map([['plink', path.resolve(__dirname, '..', '..', '..', 'bin', 'yarn-plink.cmd')]]);

// Suppress any password prompts since we run these in the background
const env = {
  GIT_ASKPASS: '',
  GIT_TERMINAL_PROMPT: 0,
  ...process.env,
};

const sshCommand = env.GIT_SSH || 'ssh';
const sshBasename = path.basename(sshCommand.toLowerCase(), '.exe');
const sshWrapper = WRAPPER_PATHS.get(sshBasename);
const sshExecutable = sshWrapper ? `"${sshWrapper}" "${sshCommand}"` : `"${sshCommand}"`;
const sshBatchArgs = BATCH_MODE_ARGS.get(sshBasename);

if (!env.GIT_SSH_COMMAND && sshBatchArgs) {
  env.GIT_SSH_COMMAND = `${sshExecutable} ${sshBatchArgs}`;
}

export const spawn = (args: Array<string>, opts?: child_process$spawnOpts = {}): Promise<string> => {
  return child.spawn('git', args, {...opts, env});
};
