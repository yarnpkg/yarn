/* @flow */
/* global child_process$spawnOpts */

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
  done: () => void,
) => void;

export function spawn(
  program: string,
  args: Array<string>,
  opts?: child_process$spawnOpts & {process?: ProcessFn} = {},
  onData?: (chunk: Buffer | string) => void,
): Promise<string> {
  return queue.push(
    opts.cwd || String(++uid),
    (): Promise<string> =>
      new Promise((resolve, reject) => {
        const proc = child.spawn(program, args, opts);

        let processingDone = false;
        let processClosed = false;
        let err = null;

        let stdout = '';

        proc.on('error', err => {
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
            err = new SpawnError(
              [
                'Command failed.',
                `Exit code: ${code}`,
                `Command: ${program}`,
                `Arguments: ${args.join(' ')}`,
                `Directory: ${opts.cwd || process.cwd()}`,
                `Output:\n${stdout.trim()}`,
              ].join('\n'),
            );
            err.EXIT_CODE = code;
          }

          if (processingDone || err) {
            finish();
          } else {
            processClosed = true;
          }
        });
      }),
  );
}
