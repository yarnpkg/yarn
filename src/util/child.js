/* @flow */
/* global child_process$spawnOpts */

import {fixCmdWinSlashes} from './fix-cmd-win-slashes.js';
import * as constants from '../constants.js';
import BlockingQueue from './blocking-queue.js';
import {MessageError, SpawnError} from '../errors.js';
import {promisify} from './promise.js';

const child = require('child_process');

export const queue = new BlockingQueue('child', constants.CHILD_CONCURRENCY);

// TODO: this uid check is kinda whack
let uid = 0;

export const exec = promisify(child.exec);

type ProcessFn = (
  proc: child_process$ChildProcess,
  update: (chunk: string) => void,
  reject: (err: mixed) => void,
  done: () => void
) => void;

export function spawn(
  program: string,
  args: Array<string>,
  opts?: child_process$spawnOpts & {process?: ProcessFn} = {},
  onData?: (chunk: Buffer | string) => void,
): Promise<string> {
  return queue.push(opts.cwd || String(++uid), (): Promise<string> => new Promise((resolve, reject) => {
    const proc = child.spawn(program, args, opts);

    let processingDone = false;
    let processClosed = false;
    let err = null;

    let stdout = '';

    proc.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(new MessageError(`Couldn't find the binary ${program}`));
      } else {
        reject(err);
      }
    });

    function updateStdout(chunk: string) {
      stdout += chunk;
      if (onData) {
        onData(chunk);
      }
    }

    function finish() {
      if (err) {
        reject(err);
      } else {
        resolve(stdout.trim());
      }
    }

    if (typeof opts.process === 'function') {
      opts.process(proc, updateStdout, reject, function() {
        if (processClosed) {
          finish();
        } else {
          processingDone = true;
        }
      });
    } else {
      if (proc.stderr) {
        proc.stderr.on('data', updateStdout);
      }

      if (proc.stdout) {
        proc.stdout.on('data', updateStdout);
      }

      processingDone = true;
    }

    proc.on('close', (code: number) => {
      if (code >= 1) {
        // TODO make this output nicer
        err = new SpawnError([
          'Command failed.',
          `Exit code: ${code}`,
          `Command: ${program}`,
          `Arguments: ${args.join(' ')}`,
          `Directory: ${opts.cwd || process.cwd()}`,
          `Output:\n${stdout.trim()}`,
        ].join('\n'));
        err.EXIT_CODE = code;
      }

      if (processingDone || err) {
        finish();
      } else {
        processClosed = true;
      }
    });
  }));
}

export async function spawnWithTicker(
  cmd: string,
  cwd: string,
  env: Object,
  tick: ?(msg: string) => void,
): Promise<string> {
  // if we don't have a spinner then pipe everything to the terminal
  const stdio = tick ? undefined : 'inherit';

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

  const stdout = await spawn(sh, [shFlag, cmd], {cwd, env, stdio, ...conf}, (data) => {
    if (tick) {
      const line = data.toString() // turn buffer into string
        .trim() // trim whitespace
        .split('\n') // split into lines
        .pop() // use only the last line
        .replace(/\t/g, ' '); // change tabs to spaces as they can interfere with the console

      if (line) {
        tick(line);
      }
    }
  });

  return stdout;
}
