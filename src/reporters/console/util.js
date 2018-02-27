/* @flow */

import tty from 'tty';
import type {Stdout} from '../types.js';

const readline = require('readline');
const {supportsColor} = require('chalk');

const CLEAR_WHOLE_LINE = 0;
const CLEAR_RIGHT_OF_CURSOR = 1;

export function clearLine(stdout: Stdout) {
  if (!supportsColor) {
    if (stdout instanceof tty.WriteStream) {
      if (stdout.columns > 0) {
        stdout.write(`\r${' '.repeat(stdout.columns - 1)}`);
      }
      stdout.write(`\r`);
    }
    return;
  }

  readline.clearLine(stdout, CLEAR_WHOLE_LINE);
  readline.cursorTo(stdout, 0);
}

export function toStartOfLine(stdout: Stdout) {
  if (!supportsColor) {
    stdout.write('\r');
    return;
  }

  readline.cursorTo(stdout, 0);
}

export function writeOnNthLine(stdout: Stdout, n: number, msg: string) {
  if (!supportsColor) {
    return;
  }

  if (n == 0) {
    readline.cursorTo(stdout, 0);
    stdout.write(msg);
    readline.clearLine(stdout, CLEAR_RIGHT_OF_CURSOR);
    return;
  }
  readline.cursorTo(stdout, 0);
  readline.moveCursor(stdout, 0, -n);
  stdout.write(msg);
  readline.clearLine(stdout, CLEAR_RIGHT_OF_CURSOR);
  readline.cursorTo(stdout, 0);
  readline.moveCursor(stdout, 0, n);
}

export function clearNthLine(stdout: Stdout, n: number) {
  if (!supportsColor) {
    return;
  }

  if (n == 0) {
    clearLine(stdout);
    return;
  }
  readline.cursorTo(stdout, 0);
  readline.moveCursor(stdout, 0, -n);
  readline.clearLine(stdout, CLEAR_WHOLE_LINE);
  readline.moveCursor(stdout, 0, n);
}
