/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */
/* global child_process$spawnOpts */

import * as constants from '../constants.js';
import BlockingQueue from './BlockingQueue.js';
import {promisify} from './promise.js';
import {MessageError} from '../errors.js';

const child = require('child_process');

export const exec = promisify(child.exec);

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

    let stderr = '';
    let stdout = '';

    proc.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(new MessageError(`Couldn't find the binary ${program}`));
      } else {
        reject(err);
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk;
      updateStdout(chunk);
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

    if (opts.process) {
      opts.process(proc, updateStdout, reject, function() {
        if (processClosed) {
          finish();
        } else {
          processingDone = true;
        }
      });
    } else {
      proc.stdout.on('data', updateStdout);
      processingDone = true;
    }

    proc.on('close', (code) => {
      if (code >= 1) {
        // TODO make this output nicer
        err = new Error([
          'Command failed.',
          `Exit code: ${code}`,
          `Command: ${program}`,
          `Arguments: ${args.join(' ')}`,
          `Directory: ${opts.cwd || process.cwd()}`,
          `Output:\n${stderr.trim()}`,
        ].join('\n'));
      }

      if (processingDone || err) {
        finish();
      } else {
        processClosed = true;
      }
    });
  }));
}
