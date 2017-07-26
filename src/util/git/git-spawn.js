/* @flow */

import * as child from '../child.js';

// Suppress any password prompts since we run these in the background
const env = {
  GIT_ASKPASS: '',
  GIT_TERMINAL_PROMPT: 0,
  GIT_SSH_COMMAND: 'ssh -oBatchMode=yes',
  ...process.env,
};

export const spawn = (args: Array<string>, opts?: child_process$spawnOpts = {}): Promise<string> => {
  return child.spawn('git', args, {...opts, env});
};
