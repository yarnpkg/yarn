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

import BaseReporter from "../_base.js";
import Progress from "./progress-bar.js";
import Spinner from "./spinner.js";
import pkg from "../../../package.json";

let readline = require("readline");
let chalk    = require("chalk");

export default class ConsoleReporter extends BaseReporter {
  _prependEmoji(msg: string, emoji: ?string): string {
    if (this.emoji && emoji && this.isTTY) msg = `${emoji}  ${msg}`;
    return msg;
  }

  step(current: number, total: number, msg: string, emoji?: string) {
    this.log(`${chalk.grey(`[${current}/${total}]`)} ${this._prependEmoji(msg, emoji)}...`);
  }

  header(command: string) {
    this.log(chalk.bold(`kpm ${command} v${pkg.version}`));
  }

  footer(showPeakMemory?: boolean) {
    let totalTime = (this.getTotalTime() / 1000).toFixed(2);
    let msg = `Done in ${totalTime}s. `;
    if (showPeakMemory) {
      let peakMemory = (this.peakMemory / 1024 / 1024).toFixed(2);
      msg += ` Peak memory usage ${peakMemory}MB.`;
    }
    this.log(this._prependEmoji(msg, "✨"));
  }

  log(msg: string) {
    this.stdout.write(`${msg}\n`);
  }

  success(msg: string) {
    this.log(`${chalk.green("success")} ${msg}`);
  }

  error(msg: string) {
    this.stderr.write(`${chalk.red("error")} ${msg}\n`);
  }

  info(msg: string) {
    this.log(`${chalk.blue("info")} ${msg}`);
  }

  command(command: string) {
    this.log(chalk.grey(`$ ${command}`));
  }

  warn(msg: string) {
    this.stderr.write(`${chalk.yellow("warning")} ${msg}\n`);
  }

  question(question: string): Promise<boolean> {
    if (!process.stdout.isTTY) {
      return Promise.reject(new Error("Can't answer a question unless a user TTY"));
    }

    question;
    return Promise.resolve(false);
  }

  activity(): {
    tick: (name: string) => void,
    end: () => void
  } {
    if (!this.isTTY) {
      return {
        tick() {},
        end() {}
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
      }
    };
  }

  select(header: string, question: string, options: Array<string>): Promise<string> {
    if (!this.isTTY) {
      return Promise.reject(new Error("Can't answer a question unless a user TTY"));
    }

    let rl = readline.createInterface({
      input: this.stdin,
      output: this.stdout,
      terminal: true
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
            this.log("Not a number");
            return ask();
          }

          if (index <= 0 || index > options.length) {
            this.log("Outside answer range");
            return ask();
          }

          // get index
          index = index - 1;
          rl.close();
          resolve(options[index]);
        });
      };

      ask();
    });
  }

  progress(count: number): () => void {
    if (count <= 0) {
      return function () {
        // noop
      };
    }

    if (!this.isTTY) {
      return function () {
        // TODO what should the behaviour here be? we could buffer progress messages maybe
      };
    }

    let bar = new Progress(count, this.stderr);

    bar.render();

    return function () {
      bar.tick();
    };
  }
}
