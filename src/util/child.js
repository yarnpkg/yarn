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
  onData: (chunk: Buffer | String | any) => void,
): Promise<string> {
  return queue.push(opts.cwd || String(++uid), (): Promise<string> => new Promise((resolve, reject) => {
    const proc = child.spawn(program, args, opts);

    let processingDone = false;
    let processClosed = false;
    let err = null;

    let errBuf = '';
    let buf = '';

    proc.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(new MessageError(`Couldn't find the binary ${program}`));
      } else {
        reject(err);
      }
    });

    proc.stderr.on('data', (chunk) => {
      errBuf += chunk;
      onData(chunk)
    });

    function update(chunk) {
      buf += chunk;
    }

    function finish() {
      if (err) {
        reject(err);
      } else {
        resolve(buf.trim());
      }
    }

    if (opts.process) {
      opts.process(proc, update, reject, function() {
        if (processClosed) {
          finish();
        } else {
          processingDone = true;
        }
      });
    } else {
      proc.stdout.on('data', update);
      processingDone = true;
    }

    proc.on('close', (code) => {
      if (code >= 1) {
        const cmd = JSON.stringify(`${program} ${args.join(' ')}`);
        errBuf = errBuf || `Process exited with code ${code}`;
        err = new Error(`${cmd}@${opts.cwd || process.cwd()}: ${errBuf.trim()}`);
      }

      if (processingDone || err) {
        finish();
      } else {
        processClosed = true;
      }
    });
  }));
}
