/* @flow */
/* global child_process$spawnOpts */

import * as constants from '../constants.js';
import BlockingQueue from './blocking-queue.js';
import {ProcessSpawnError, ProcessTermError} from '../errors.js';
import {promisify} from './promise.js';

const os = require('os');
const child = require('child_process');
const fs = require('fs');
const path = require('path');

export const queue = new BlockingQueue('child', constants.CHILD_CONCURRENCY);

// TODO: this uid check is kinda whack
let uid = 0;

export const exec = promisify(child.exec);

function validate(program: string, opts?: Object = {}) {
  if (program.match(/[\\\/]/)) {
    return;
  }

  if (process.platform === 'win32' && process.env.PATHEXT) {
    const cwd = opts.cwd || process.cwd();
    const pathext = process.env.PATHEXT;

    for (const ext of pathext.split(';')) {
      const candidate = path.join(cwd, `${program}${ext}`);
      if (fs.existsSync(candidate)) {
        throw new Error(`Potentially dangerous call to "${program}" in ${cwd}`);
      }
    }
  }
}

export function forkp(program: string, args: Array<string>, opts?: Object): Promise<number> {
  validate(program, opts);
  const key = String(++uid);
  return new Promise((resolve, reject) => {
    const proc = child.fork(program, args, opts);
    spawnedProcesses[key] = proc;

    proc.on('error', error => {
      reject(error);
    });

    proc.on('close', (exitCode: number, signal: string) => {
      resolve(exitCode ?? 128 + os.constants.signals[signal]);
    });
  });
}

export function spawnp(program: string, args: Array<string>, opts?: Object): Promise<number> {
  validate(program, opts);
  const key = String(++uid);
  return new Promise((resolve, reject) => {
    const proc = child.spawn(program, args, opts);
    spawnedProcesses[key] = proc;

    proc.on('error', error => {
      reject(error);
    });

    proc.on('close', (exitCode: number, signal: string) => {
      resolve(exitCode ?? 128 + os.constants.signals[signal]);
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
  opts?: child_process$spawnOpts & {detached?: boolean, process?: ProcessFn} = {},
  onData?: (chunk: Buffer | string) => void,
): Promise<string> {
  const key = opts.cwd || String(++uid);
  return queue.push(
    key,
    (): Promise<string> =>
      new Promise((resolve, reject) => {
        validate(program, opts);

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
          } else {
            processClosed = true;
          }
        });
      }),
  );
}
