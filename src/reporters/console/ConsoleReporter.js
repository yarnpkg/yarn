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

import BaseReporter from '../BaseReporter.js';
import Progress from './ProgressBar.js';
import Spinner from './Spinner.js';
import type {Package, Trees} from '../types.js';
import {clearLine} from './util.js';
import {removeSuffix} from '../../util/misc.js';

let readline = require('readline');
let repeat = require('repeating');
let chalk = require('chalk');
let read = require('read');
let _ = require('lodash');

function sortTrees(trees: Trees = []): Trees {
  return trees.sort(function(tree1, tree2): number {
    return tree1.name.localeCompare(tree2.name);
  });
}

export default class ConsoleReporter extends BaseReporter {
  _prependEmoji(msg: string, emoji: ?string): string {
    if (this.emoji && emoji && this.isTTY) {
      msg = `${emoji}  ${msg}`;
    }
    return msg;
  }

  step(current: number, total: number, msg: string, emoji?: string) {
    msg = this._prependEmoji(msg, emoji);

    if (_.endsWith(msg, '?')) {
      msg = `${removeSuffix(msg, '?')}...?`;
    } else {
      msg += '...';
    }

    this.log(`${chalk.grey(`[${current}/${total}]`)} ${msg}`);
  }

  list(key: string, items: Array<string>) {
    for (let item of items) {
      this.log(`   - ${item}`);
    }
  }

  header(command: string, pkg: Package) {
    this.log(chalk.bold(`${pkg.name} ${command} v${pkg.version}`));
  }

  footer(showPeakMemory?: boolean) {
    let totalTime = (this.getTotalTime() / 1000).toFixed(2);
    let msg = `Done in ${totalTime}s.`;
    if (showPeakMemory) {
      let peakMemory = (this.peakMemory / 1024 / 1024).toFixed(2);
      msg += ` Peak memory usage ${peakMemory}MB.`;
    }
    this.log(this._prependEmoji(msg, '✨'));
  }

  log(msg: string) {
    clearLine(this.stdout);
    this.stdout.write(`${msg}\n`);
  }

  success(msg: string) {
    this.log(`${chalk.green('success')} ${msg}`);
  }

  error(msg: string) {
    clearLine(this.stderr);
    this.stderr.write(`${chalk.red('error')} ${msg}\n`);
  }

  info(msg: string) {
    this.log(`${chalk.blue('info')} ${msg}`);
  }

  command(command: string) {
    this.log(chalk.grey(`$ ${command}`));
  }

  warn(msg: string) {
    clearLine(this.stderr);
    this.stderr.write(`${chalk.yellow('warning')} ${msg}\n`);
  }

  question(question: string, password?: boolean): Promise<string> {
    if (!process.stdout.isTTY) {
      return Promise.reject(new Error("Can't answer a question unless a user TTY"));
    }

    return new Promise((resolve, reject) => {
      read({
        prompt: `${chalk.grey('question')} ${question}: `,
        silent: !!password,
        output: this.stdout,
        input: this.stdin,
      }, (err, answer) => {
        if (err) {
          reject(err);
        } else {
          resolve(answer);
        }
      });
    });
  }

  tree(key: string, trees: Trees) {
    trees = sortTrees(trees);

    let stdout = this.stdout;

    function output({name, children, hint, color}, level, end) {
      children = sortTrees(children);

      let indent = end ? '└' : '├';

      if (level) {
        indent = repeat('│  ', level) + indent;
      }

      let suffix = '';
      if (hint) {
        suffix += ` (${chalk.grey(hint)})`;
      }
      if (color) {
        name = chalk[color](name);
      }
      stdout.write(`${indent}─ ${name}${suffix}\n`);

      if (children && children.length) {
        for (let i = 0; i < children.length; i++) {
          let tree = children[i];
          output(tree, level + 1, i === children.length - 1);
        }
      }
    }

    for (let i = 0; i < trees.length; i++) {
      let tree = trees[i];
      output(tree, 0, i === trees.length - 1);
    }
  }

  activity(): {
    tick: (name: string) => void,
    end: () => void
  } {
    if (!this.isTTY) {
      return {
        tick() {},
        end() {},
      };
    }

    let spinner = new Spinner(this.stderr);
    spinner.start();

    return {
      tick(name: string) {
        spinner.setText(name);
      },

      end() {
        spinner.stop();
      },
    };
  }

  select(header: string, question: string, options: Array<string>): Promise<string> {
    if (!this.isTTY) {
      return Promise.reject(new Error("Can't answer a question unless a user TTY"));
    }

    let rl = readline.createInterface({
      input: this.stdin,
      output: this.stdout,
      terminal: true,
    });

    return new Promise((resolve) => {
      this.log(header);

      for (let i = 0; i < options.length; i++) {
        this.log(`${i + 1}. ${options[i]}`);
      }

      let ask = () => {
        rl.question(`${question}?: `, (index) => {
          index = +index;

          if (isNaN(index)) {
            this.log('Not a number');
            ask();
            return;
          }

          if (index <= 0 || index > options.length) {
            this.log('Outside answer range');
            ask();
            return;
          }

          // get index
          index--;
          rl.close();
          resolve(options[index]);
        });
      };

      ask();
    });
  }

  progress(count: number): () => void {
    if (count <= 0) {
      return function() {
        // noop
      };
    }

    if (!this.isTTY) {
      return function() {
        // TODO what should the behaviour here be? we could buffer progress messages maybe
      };
    }

    let bar = new Progress(count, this.stderr);

    bar.render();

    return function() {
      bar.tick();
    };
  }
}
