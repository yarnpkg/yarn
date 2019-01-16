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
  PromptOptions,
} from './types.js';
import type {LanguageKeys} from './lang/en.js';
import type {Formatter} from './format.js';
import type {AuditMetadata, AuditActionRecommendation, AuditAdvisory, AuditResolution} from '../cli/commands/audit';

import {defaultFormatter} from './format.js';
import * as languages from './lang/index.js';
import isCI from 'is-ci';
import os from 'os';

const util = require('util');
const EventEmitter = require('events').EventEmitter;

type Language = $Keys<typeof languages>;

export type ReporterOptions = {
  verbose?: boolean,
  language?: Language,
  stdout?: Stdout,
  stderr?: Stdout,
  stdin?: Stdin,
  emoji?: boolean,
  noProgress?: boolean,
  silent?: boolean,
  nonInteractive?: boolean,
};

export function stringifyLangArgs(args: Array<any>): Array<string> {
  return args.map(function(val): string {
    if (val != null && val.inspect) {
      return val.inspect();
    } else {
      try {
        const str = JSON.stringify(val) || val + '';
        // should match all literal line breaks and
        // "u001b" that follow an odd number of backslashes and convert them to ESC
        // we do this because the JSON.stringify process has escaped these characters
        return str
          .replace(/((?:^|[^\\])(?:\\{2})*)\\u001[bB]/g, '$1\u001b')
          .replace(/[\\]r[\\]n|([\\])?[\\]n/g, (match, precededBacklash) => {
            // precededBacklash not null when "\n" is preceded by a backlash ("\\n")
            // match will be "\\n" and we don't replace it with os.EOL
            return precededBacklash ? match : os.EOL;
          });
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
    this.stdin = opts.stdin || this._getStandardInput();
    this.emoji = !!opts.emoji;
    this.nonInteractive = !!opts.nonInteractive;
    this.noProgress = !!opts.noProgress || isCI;
    this.isVerbose = !!opts.verbose;

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
  isVerbose: boolean;
  isSilent: boolean;
  nonInteractive: boolean;
  format: Formatter;

  peakMemoryInterval: ?IntervalID;
  peakMemory: number;
  startTime: number;

  lang(key: LanguageKeys, ...args: Array<mixed>): string {
    const msg = languages[this.language][key] || languages.en[key];
    if (!msg) {
      throw new ReferenceError(`No message defined for language key ${key}`);
    }

    // stringify args
    const stringifiedArgs = stringifyLangArgs(args);

    // replace $0 placeholders with args
    return msg.replace(/\$(\d+)/g, (str, i: number) => {
      return stringifiedArgs[i];
    });
  }

  /**
   * `stringifyLangArgs` run `JSON.stringify` on strings too causing
   * them to appear quoted. This marks them as "raw" and prevents
   * the quoting and escaping
   */
  rawText(str: string): {inspect(): string} {
    return {
      inspect(): string {
        return str;
      },
    };
  }

  verbose(msg: string) {
    if (this.isVerbose) {
      this._verbose(msg);
    }
  }

  verboseInspect(val: any) {
    if (this.isVerbose) {
      this._verboseInspect(val);
    }
  }

  _verbose(msg: string) {}
  _verboseInspect(val: any) {}

  _getStandardInput(): Stdin {
    let standardInput;

    // Accessing stdin in a win32 headless process (e.g., Visual Studio) may throw an exception.
    try {
      standardInput = process.stdin;
    } catch (e) {
      console.warn(e.message);
      delete process.stdin;
      // $FlowFixMe: this is valid!
      process.stdin = new EventEmitter();
      standardInput = process.stdin;
    }

    return standardInput;
  }

  initPeakMemoryCounter() {
    this.checkPeakMemory();
    this.peakMemoryInterval = setInterval(() => {
      this.checkPeakMemory();
    }, 1000);
    // $FlowFixMe: Node's setInterval returns a Timeout, not a Number
    this.peakMemoryInterval.unref();
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
  list(key: string, items: Array<string>, hints?: Object) {}

  // Outputs basic tree structure to console
  tree(key: string, obj: Trees, {force = false}: {force?: boolean} = {}) {}

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
  // TODO: rethink the {force} parameter. In the meantime, please don't use it (cf comments in #4143).
  log(message: string, {force = false}: {force?: boolean} = {}) {}

  // a shell command has been executed
  command(command: string) {}

  // inspect and pretty-print any value
  inspect(value: any) {}

  // the screen shown at the very start of the CLI
  header(command: string, pkg: Package) {}

  // the screen shown at the very end of the CLI
  footer(showPeakMemory: boolean) {}

  // a table structure
  table(head: Array<string>, body: Array<Array<string>>) {}

  // security audit action to resolve advisories
  auditAction(recommendation: AuditActionRecommendation) {}

  // security audit requires manual review
  auditManualReview() {}

  // security audit advisory
  auditAdvisory(resolution: AuditResolution, auditAdvisory: AuditAdvisory) {}

  // summary for security audit report
  auditSummary(auditMetadata: AuditMetadata) {}

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
    if (this.nonInteractive) {
      return true;
    }

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

  // utility function to disable progress bar
  disableProgress() {
    this.noProgress = true;
  }

  //
  prompt<T>(message: string, choices: Array<*>, options?: PromptOptions = {}): Promise<Array<T>> {
    return Promise.reject(new Error('Not implemented'));
  }
}
