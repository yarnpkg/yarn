/* @flow */
/* global child_process$spawnOpts */

import type {Readable, Writable} from 'stream';

import child from 'child_process';

import semver from 'semver';

import * as constants from '../constants.js';
import BlockingQueue from './blocking-queue.js';
import {ProcessSpawnError, ProcessTermError} from '../errors.js';
import {promisify} from './promise.js';

const noop = (_1: mixed, _2: mixed) => {};

// Workaround for stream handling bug in Node.js <= 6.2.1 on Linux. See #4282
const fixFaultyNode6Stream = semver.satisfies(process.versions.node, '<= 6.2.1')
  ? (stream: Readable | Writable, checkProcClosed: () => boolean) => {
      stream.on('readable', noop);
      stream.once('close', () => {
        if (!checkProcClosed()) {
          stream.removeListener('readable', noop);
        }
      });
    }
  : null;

export const queue = new BlockingQueue('child', constants.CHILD_CONCURRENCY);

// TODO: this uid check is kinda whack
let uid = 0;

export const exec = promisify(child.exec);

export function forkp(program: string, args: Array<string>, opts?: Object): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = child.fork(program, args, opts);

    proc.on('error', error => {
      reject(error);
    });

    proc.on('close', exitCode => {
      resolve(exitCode);
    });
  });
}

export function spawnp(program: string, args: Array<string>, opts?: Object): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = child.spawn(program, args, opts);

    proc.on('error', error => {
      reject(error);
    });

    proc.on('close', exitCode => {
      resolve(exitCode);
    });
  });
}

const spawnedProcesses = {};

export function forwardSignalToSpawnedProcesses(signal: string) {
  for (const key of Object.keys(spawnedProcesses)) {
    spawnedProcesses[key].kill(signal);
  }
}

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
  const key = opts.cwd || String(++uid);
  return queue.push(
    key,
    (): Promise<string> =>
      new Promise((resolve, reject) => {
        const proc = child.spawn(program, args, opts);
        spawnedProcesses[key] = proc;

        let processingDone = false;
        let processClosed = false;
        let err = null;

        let stdout = '';

        proc.on('error', err => {
          if (err.code === 'ENOENT') {
            reject(new ProcessSpawnError(`Couldn't find the binary ${program}`, err.code, program));
          } else {
            reject(err);
          }
        });

        if (fixFaultyNode6Stream) {
          const isProcClosed = () => processClosed;
          if (proc.stdout) {
            fixFaultyNode6Stream(proc.stdout, isProcClosed);
          }
          if (proc.stderr) {
            fixFaultyNode6Stream(proc.stderr, isProcClosed);
          }
        }

        function updateStdout(chunk: string) {
          stdout += chunk;
          if (onData) {
            onData(chunk);
          }
        }

        function finish() {
          delete spawnedProcesses[key];
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

        proc.on('close', (code: number, signal: string) => {
          if (signal || code >= 1) {
            err = new ProcessTermError(
              [
                'Command failed.',
                signal ? `Exit signal: ${signal}` : `Exit code: ${code}`,
                `Command: ${program}`,
                `Arguments: ${args.join(' ')}`,
                `Directory: ${opts.cwd || process.cwd()}`,
                `Output:\n${stdout.trim()}`,
              ].join('\n'),
            );
            err.EXIT_SIGNAL = signal;
            err.EXIT_CODE = code;
          }

          if (processingDone || err) {
            finish();
          }

          processClosed = true;
        });
      }),
  );
}
