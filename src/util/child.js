/* @flow */
/* global child_process$spawnOpts */

import * as constants from '../constants.js';
import BlockingQueue from './blocking-queue.js';
import {MessageError, SpawnError} from '../errors.js';

const child = require('child_process2');

export const queue = new BlockingQueue('child', constants.CHILD_CONCURRENCY);

// TODO: this uid check is kinda whack
let uid = 0;

export function spawn(
  program: string,
  args: Array<string>,
  opts?: child_process$spawnOpts = {},
  onData?: (chunk: Buffer | String | any) => void,
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

    function updateStdout(chunk) {
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

    proc.on('close', (code) => {
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
