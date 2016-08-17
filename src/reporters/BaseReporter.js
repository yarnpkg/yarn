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
/* eslint no-unused-vars: 0 */

import type {Trees, Stdout, Stdin, Package} from './types.js';

export type ReporterOptions = {
  stdout?: Stdout,
  stderr?: Stdout,
  stdin?: Stdin,
  emoji?: boolean,
};

export default class BaseReporter {
  constructor(opts?: ReporterOptions = {}) {
    this.stdout = opts.stdout || process.stdout;
    this.stderr = opts.stderr || process.stderr;
    this.stdin  = opts.stdin || process.stdin;
    this.emoji  = !!opts.emoji;

    // $FlowFixMe: this is valid!
    this.isTTY = this.stdout.isTTY;

    this.peakMemory = 0;
    this.startTime  = Date.now();
  }

  stdout: Stdout;
  stderr: Stdout;
  stdin: Stdin;
  isTTY: boolean;
  emoji: boolean;

  peakMemoryInterval: ?number;
  peakMemory: number;
  startTime: number;

  initPeakMemoryCounter() {
    this.checkPeakMemory();
    this.peakMemoryInterval = setInterval(() => {
      this.checkPeakMemory();
    }, 1000);
  }

  checkPeakMemory() {
    const {heapTotal} = process.memoryUsage();
    if (heapTotal > this.peakMemory) {
      this.peakMemory = heapTotal;
    }
  }

  close() {
    if (this.peakMemoryInterval) {
      clearInterval(this.peakMemoryInterval);
      this.peakMemoryInterval = null;
    }
  }

  getTotalTime(): number {
    return Date.now() - this.startTime;
  }

  // TODO
  list(key: string, items: Array<string>) {}

  // TODO
  tree(key: string, obj: Trees) {}

  // called whenever we begin a step in the CLI.
  step(current: number, total: number, message: string, emoji?: string) {}

  // a error message has been triggered. this however does not always meant an abrupt
  // program end.
  error(message: string) {}

  // an info message has been triggered. this provides things like stats and diagnostics.
  info(message: string) {}

  // a warning message has been triggered.
  warn(message: string) {}

  // a success message has been triggered.
  success(message: string) {}

  // a simple log message
  log(message: string) {}

  // a shell command has been executed
  command(command: string) {}

  // the screen shown at the very start of the CLI
  header(command: string, pkg: Package) {}

  // the screen shown at the very end of the CLI
  footer(showPeakMemory: boolean) {}

  // render an activity spinner and return a function that will trigger an update
  activity(): {
    tick: (name: string) => void,
    end: () => void
  } {
    return {
      tick(name: string) {},
      end() {},
    };
  }

  //
  question(question: string): Promise<boolean> {
    return Promise.reject(new Error('Not implemented'));
  }

  // prompt the user to select an option from an array
  select(header: string, question: string, options: Array<string>): Promise<string> {
    return Promise.reject(new Error('Not implemented'));
  }

  // render a progress bar and return a function which when called will trigger an update
  progress(total: number): Function {
    return function() {};
  }
}
