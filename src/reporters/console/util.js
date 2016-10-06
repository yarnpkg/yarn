/* @flow */

import type {Stdout} from '../types.js';

const readline = require('readline');

export function clearLine(stdout: Stdout) {
  readline.clearLine(stdout, 0);
  readline.cursorTo(stdout, 0);
}

export function toStartOfLine(stdout: Stdout) {
  readline.cursorTo(stdout, 0);
}

export function writeOnNthLine(stdout: Stdout, n: number, msg: string) {
  if (n == 0) {
    clearLine(stdout);
    stdout.write(msg);
    return;
  }
  readline.cursorTo(stdout, 0);
  readline.moveCursor(stdout, 0, -n);
  readline.clearLine(stdout, 0);
  stdout.write(msg);
  readline.cursorTo(stdout, 0);
  readline.moveCursor(stdout, 0, n);
}

export function clearNthLine(stdout: Stdout, n: number) {
  if (n == 0) {
    clearLine(stdout);
    return;
  }
  readline.cursorTo(stdout, 0);
  readline.moveCursor(stdout, 0, -n);
  readline.clearLine(stdout, 0);
  readline.moveCursor(stdout, 0, n);
}
