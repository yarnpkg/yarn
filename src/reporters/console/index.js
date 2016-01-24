/* @flow */

import BaseReporter from "../_base";
import Spinner from "./spinner";
import pkg from "../../../package.json";

let Progress = require("progress");
let readline = require("readline");
let chalk    = require("chalk");

function prependEmoji(msg, emoji) {
  if (emoji && process.stdout.isTTY) msg = `${emoji}  ${msg}`;
  return msg;
}

function createReadline() {
  // $FlowFixMe: Flow probably doesn't have this definition
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });
}

export default class ConsoleReporter extends BaseReporter {
  step(current: number, total: number, msg: string, emoji: string) {
    console.log(`${chalk.grey(`[${current}/${total}]`)} ${prependEmoji(msg, emoji)}...`);
  }

  header(command: string) {
    console.log(chalk.bold(`kpm ${command} v${pkg.version}`));
  }

  footer() {
    console.log(prependEmoji(`Done in ${(this.getTotalTime() / 1000).toFixed(2)}s.`, "✨"));
  }

  log(msg: string) {
    console.log(msg);
  }

  success(msg: string) {
    console.log(`${chalk.green("success")} ${msg}`);
  }

  error(msg: string) {
    console.error(`${chalk.red("error")} ${msg}`);
  }

  info(msg: string) {
    console.log(`${chalk.blue("info")} ${msg}`);
  }

  command(command: string) {
    console.log(chalk.grey(`$ ${command}`));
  }

  warn(msg: string) {
    console.log(`${chalk.yellow("warning")} ${msg}`);
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
    if (!process.stdout.isTTY) {
      return Promise.reject(new Error("Can't answer a question unless a TTY"));
    }

    let rl = createReadline();

    return new Promise((resolve) => {
      console.log(header);

      for (let i = 0; i < options.length; i++) {
        console.log(`${i + 1}. ${options[i]}`);
      }

      let ask = () => {
        rl.question(`${question}?: `, function (index) {
          index = +index;

          if (isNaN(index)) {
            console.log("Not a number");
            return ask();
          }

          if (index <= 0 || index > options.length) {
            console.log("Outside answer range");
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

    let bar = new Progress(":bar :current/:total", {
      total: count,
      clear: true,
      complete: "█",
      incomplete: "░",
    });

    bar.render();

    return function () {
      bar.tick();
    };
  }
}
