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
let isCI     = require("is-ci");

function prependEmoji(msg, emoji) {
  if (emoji && process.stdout.isTTY) msg = `${emoji}  ${msg}`;
  return msg;
}

function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });
}

export default class ConsoleReporter extends BaseReporter {
  step(current: number, total: number, msg: string, emoji: string) {
    this.console.log(`${chalk.grey(`[${current}/${total}]`)} ${prependEmoji(msg, emoji)}...`);
  }

  header(command: string) {
    this.console.log(chalk.bold(`kpm ${command} v${pkg.version}`));
  }

  footer() {
    let totalTime = (this.getTotalTime() / 1000).toFixed(2);
    let peakMemory = (this.peakMemory / 1024 / 1024).toFixed(2);
    this.console.log(prependEmoji(`Done in ${totalTime}s. Peak memory usage ${peakMemory}MB.`, "✨"));
  }

  log(msg: string) {
    this.console.log(msg);
  }

  success(msg: string) {
    this.console.log(`${chalk.green("success")} ${msg}`);
  }

  error(msg: string) {
    this.console.error(`${chalk.red("error")} ${msg}`);
  }

  info(msg: string) {
    this.console.log(`${chalk.blue("info")} ${msg}`);
  }

  command(command: string) {
    this.console.log(chalk.grey(`$ ${command}`));
  }

  warn(msg: string) {
    this.console.log(`${chalk.yellow("warning")} ${msg}`);
  }

  question(question: string): Promise<boolean> {
    if (isCI || !process.stdout.isTTY) {
      return Promise.reject(new Error("Can't answer a question unless a user TTY"));
    }

    question;
    return Promise.resolve(false);
  }

  activity(): {
    tick: (name: string) => void,
    end: () => void
  } {
    if (!process.stdout.isTTY) {
      return {
        tick() {},
        end() {}
      };
    }

    let spinner = new Spinner;
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
    if (isCI || !process.stdout.isTTY) {
      return Promise.reject(new Error("Can't answer a question unless a user TTY"));
    }

    let rl = createReadline();

    return new Promise((resolve) => {
      this.console.log(header);

      for (let i = 0; i < options.length; i++) {
        this.console.log(`${i + 1}. ${options[i]}`);
      }

      let ask = () => {
        rl.question(`${question}?: `, (index) => {
          index = +index;

          if (isNaN(index)) {
            this.console.log("Not a number");
            return ask();
          }

          if (index <= 0 || index > options.length) {
            this.console.log("Outside answer range");
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

  progress(count: number): Function {
    if (count <= 0) {
      return function () {
        // noop
      };
    }

    if (!process.stdout.isTTY) {
      return function () {
        // TODO what should the behaviour here be? we could buffer progress messages maybe
      };
    }

    let bar = new Progress(count);

    bar.render();

    return function () {
      bar.tick();
    };
  }
}
