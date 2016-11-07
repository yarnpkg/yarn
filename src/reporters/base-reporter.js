/* @flow */
/* eslint no-unused-vars: 0 */

import type {
  ReporterSpinnerSet,
  ReporterSelectOption,
  Trees,
  Stdout,
  Stdin,
  Package,
  ReporterSpinner,
  QuestionOptions,
} from './types.js';
import type {LanguageKeys} from './lang/en.js';
import type {Formatter} from './format.js';
import {defaultFormatter} from './format.js';
import * as languages from './lang/index.js';
import isCI from 'is-ci';

const util = require('util');

type Language = $Keys<typeof languages>;

export type ReporterOptions = {
  language?: Language,
  stdout?: Stdout,
  stderr?: Stdout,
  stdin?: Stdin,
  emoji?: boolean,
  noProgress?: boolean,
};

export function stringifyLangArgs(args: Array<any>): Array<string> {
  return args.map(function(val): string {
    if (val != null && val.inspect) {
      return val.inspect();
    } else {
      try {
        return JSON.stringify(val) || val + '';
      } catch (e) {
        return util.inspect(val);
      }
    }
  });
}

export default class BaseReporter {
  constructor(opts?: ReporterOptions = {}) {
    const lang = 'en';
    this.language = lang;

    this.stdout = opts.stdout || process.stdout;
    this.stderr = opts.stderr || process.stderr;
    this.stdin = opts.stdin || process.stdin;
    this.emoji = !!opts.emoji;
    this.noProgress = !!opts.noProgress || isCI;

    // $FlowFixMe: this is valid!
    this.isTTY = this.stdout.isTTY;

    this.peakMemory = 0;
    this.startTime = Date.now();
    this.format = defaultFormatter;
  }

  formatter: Formatter;
  language: Language;
  stdout: Stdout;
  stderr: Stdout;
  stdin: Stdin;
  isTTY: boolean;
  emoji: boolean;
  noProgress: boolean;
  format: Formatter;

  peakMemoryInterval: ?number;
  peakMemory: number;
  startTime: number;

  lang(key: LanguageKeys, ...args: Array<mixed>): string {
    const msg = languages[this.language][key] || languages.en[key];
    if (!msg) {
      throw new ReferenceError(`Unknown language key ${key}`);
    }

    // stringify args
    const stringifiedArgs = stringifyLangArgs(args);

    // replace $0 placeholders with args
    return msg.replace(/\$(\d+)/g, (str, i: number) => {
      return stringifiedArgs[i];
    });
  }

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

  // Outputs basic tree structure to console
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

  // inspect and pretty-print any value
  inspect(value: any) {}

  // the screen shown at the very start of the CLI
  header(command: string, pkg: Package) {}

  // the screen shown at the very end of the CLI
  footer(showPeakMemory: boolean) {}

  //
  table(head: Array<string>, body: Array<Array<string>>) {}

  // render an activity spinner and return a function that will trigger an update
  activity(): ReporterSpinner {
    return {
      tick(name: string) {},
      end() {},
    };
  }

  //
  activitySet(total: number, workers: number): ReporterSpinnerSet {
    return {
      spinners: Array(workers).fill({
        clear() {},
        setPrefix() {},
        tick() {},
        end() {},
      }),
      end() {},
    };
  }

  //
  question(question: string, options?: QuestionOptions = {}): Promise<string> {
    return Promise.reject(new Error('Not implemented'));
  }

  //
  async questionAffirm(question: string): Promise<boolean> {
    const condition = true; // trick eslint

    while (condition) {
      let answer = await this.question(question);
      answer = answer.toLowerCase();

      if (answer === 'y' || answer === 'yes') {
        return true;
      }
      if (answer === 'n' || answer === 'no') {
        return false;
      }

      this.error('Invalid answer for question');
    }

    return false;
  }

  // prompt the user to select an option from an array
  select(header: string, question: string, options: Array<ReporterSelectOption>): Promise<string> {
    return Promise.reject(new Error('Not implemented'));
  }

  // render a progress bar and return a function which when called will trigger an update
  progress(total: number): () => void {
    return function() {};
  }
}
