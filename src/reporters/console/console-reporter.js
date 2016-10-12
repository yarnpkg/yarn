/* @flow */

import type {
  ReporterSpinnerSet,
  Package,
  Trees,
  ReporterSpinner,
  ReporterSelectOption,
  QuestionOptions,
} from '../types.js';
import type {FormatKeys} from '../format.js';
import BaseReporter from '../base-reporter.js';
import Progress from './progress-bar.js';
import Spinner from './spinner-progress.js';
import {clearLine} from './util.js';
import {removeSuffix} from '../../util/misc.js';

const {inspect} = require('util');
const readline = require('readline');
const repeat = require('repeating');
const chalk = require('chalk');
const read = require('read');

function sortTrees(trees: Trees = []): Trees {
  return trees.sort(function(tree1, tree2): number {
    return tree1.name.localeCompare(tree2.name);
  });
}

type Row = Array<string>;

export default class ConsoleReporter extends BaseReporter {
  constructor(opts: Object) {
    super(opts);
    this._lastCategorySize = 0;

    this.format = chalk;
  }

  // TODO flow bug
  format: any;

  _lastCategorySize: number;

  _prependEmoji(msg: string, emoji: ?string): string {
    if (this.emoji && emoji && this.isTTY) {
      msg = `${emoji}  ${msg}`;
    }
    return msg;
  }

  _logCategory(category: string, color: FormatKeys, msg: string) {
    this._lastCategorySize = category.length;
    this._log(`${this.format[color](category)} ${msg}`);
  }

  table(head: Array<string>, body: Array<Row>) {
    //
    head = head.map((field: string): string => this.format.underline(field));

    //
    const rows = [head].concat(body);

    // get column widths
    const cols: Array<number> = [];
    for (let i = 0; i < head.length; i++) {
      const widths = rows.map((row: Row): number => this.format.stripColor(row[i]).length);
      cols[i] = Math.max(...widths);
    }

    //
    const builtRows = rows.map((row: Row): string => {
      for (let i = 0; i < row.length; i++) {
        const field = row[i];
        const padding = cols[i] - this.format.stripColor(field).length;

        row[i] = field + repeat(' ', padding);
      }
      return row.join(' ');
    });

    this.log(builtRows.join('\n'));
  }

  step(current: number, total: number, msg: string, emoji?: string) {
    msg = this._prependEmoji(msg, emoji);

    if (msg.endsWith('?')) {
      msg = `${removeSuffix(msg, '?')}...?`;
    } else {
      msg += '...';
    }

    this.log(`${this.format.grey(`[${current}/${total}]`)} ${msg}`);
  }

  inspect(value: any) {
    if (typeof value !== 'number' && typeof value !== 'string') {
      value = inspect(value, {
        breakLength: 0,
        colors: true,
        depth: null,
        maxArrayLength: null,
      });
    }

    this.log(value);
  }

  list(key: string, items: Array<string>) {
    const gutterWidth = (this._lastCategorySize || 2) - 1;
    for (const item of items) {
      this._log(`${repeat(' ', gutterWidth)}- ${item}`);
    }
  }

  header(command: string, pkg: Package) {
    this.log(this.format.bold(`${pkg.name} ${command} v${pkg.version}`));
  }

  footer(showPeakMemory?: boolean) {
    const totalTime = (this.getTotalTime() / 1000).toFixed(2);
    let msg = `Done in ${totalTime}s.`;
    if (showPeakMemory) {
      const peakMemory = (this.peakMemory / 1024 / 1024).toFixed(2);
      msg += ` Peak memory usage ${peakMemory}MB.`;
    }
    this.log(this._prependEmoji(msg, '✨'));
  }

  log(msg: string) {
    this._lastCategorySize = 0;
    this._log(msg);
  }

  _log(msg: string) {
    clearLine(this.stdout);
    this.stdout.write(`${msg}\n`);
  }

  success(msg: string) {
    this._logCategory('success', 'green', msg);
  }

  error(msg: string) {
    clearLine(this.stderr);
    this.stderr.write(`${this.format.red('error')} ${msg}\n`);
  }

  info(msg: string) {
    this._logCategory('info', 'blue', msg);
  }

  command(command: string) {
    this.log(this.format.grey(`$ ${command}`));
  }

  warn(msg: string) {
    clearLine(this.stderr);
    this.stderr.write(`${this.format.yellow('warning')} ${msg}\n`);
  }

  question(question: string, options?: QuestionOptions = {}): Promise<string> {
    if (!process.stdout.isTTY) {
      return Promise.reject(new Error("Can't answer a question unless a user TTY"));
    }

    return new Promise((resolve, reject) => {
      read({
        prompt: `${this.format.grey('question')} ${question}: `,
        silent: !!options.password,
        output: this.stdout,
        input: this.stdin,
      }, (err, answer) => {
        if (err) {
          if (err.message === 'canceled') {
            process.exit(1);
          } else {
            reject(err);
          }
        } else {
          if (!answer && options.required) {
            this.error(this.lang('answerRequired'));
            resolve(this.question(question, options));
          } else {
            resolve(answer);
          }
        }
      });
    });
  }

  tree(key: string, trees: Trees) {
    trees = sortTrees(trees);

    const stdout = this.stdout;

    const output = ({name, children, hint, color}, level, end) => {
      children = sortTrees(children);

      let indent = end ? '└' : '├';

      if (level) {
        indent = repeat('│  ', level) + indent;
      }

      let suffix = '';
      if (hint) {
        suffix += ` (${this.format.grey(hint)})`;
      }
      if (color) {
        name = this.format[color](name);
      }
      stdout.write(`${indent}─ ${name}${suffix}\n`);

      if (children && children.length) {
        for (let i = 0; i < children.length; i++) {
          const tree = children[i];
          output(tree, level + 1, i === children.length - 1);
        }
      }
    };

    for (let i = 0; i < trees.length; i++) {
      const tree = trees[i];
      output(tree, 0, i === trees.length - 1);
    }
  }

  activitySet(total: number, workers: number): ReporterSpinnerSet {
    if (!this.isTTY) {
      return super.activitySet(total, workers);
    }

    const spinners = [];

    for (let i = 1; i < workers; i++) {
      this.log('');
    }

    for (let i = 0; i < workers; i++) {
      const spinner = new Spinner(this.stderr, i);
      spinner.start();

      let prefix: ?string = null;
      let current = 0;
      const updatePrefix = () => {
        spinner.setPrefix(
          `${this.format.grey(`[${current === 0 ? '-' : current}/${total}]`)} `,
        );
      };
      const clear = () => {
        prefix = null;
        current = 0;
        updatePrefix();
        spinner.setText('waiting...');
      };
      clear();

      spinners.unshift({
        clear,

        setPrefix(_current: number, _prefix: string) {
          current = _current;
          prefix = _prefix;
          spinner.setText(prefix);
          updatePrefix();
        },

        tick(msg: string) {
          if (prefix) {
            msg = `${prefix}: ${msg}`;
          }
          spinner.setText(msg);
        },

        end() {
          spinner.stop();
        },
      });
    }

    return {
      spinners,
      end: () => {
        for (const spinner of spinners) {
          spinner.end();
        }
        readline.moveCursor(this.stdout, 0, -workers + 1);
      },
    };
  }

  activity(): ReporterSpinner {
    if (!this.isTTY) {
      return {
        tick() {},
        end() {},
      };
    }

    const spinner = new Spinner(this.stderr);
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

  select(header: string, question: string, options: Array<ReporterSelectOption>): Promise<string> {
    if (!this.isTTY) {
      return Promise.reject(new Error("Can't answer a question unless a user TTY"));
    }

    const rl = readline.createInterface({
      input: this.stdin,
      output: this.stdout,
      terminal: true,
    });

    const questions = options.map((opt): string => opt.name);
    const answers = options.map((opt): string => opt.value);

    function toIndex(input: string): number {
      const index = answers.indexOf(input);

      if (index >= 0) {
        return index;
      } else {
        return +input;
      }
    }

    return new Promise((resolve) => {
      this.info(header);

      for (let i = 0; i < questions.length; i++) {
        this.log(`  ${this.format.dim(`${i + 1})`)} ${questions[i]}`);
      }

      const ask = () => {
        rl.question(`${question}: `, (input) => {
          let index = toIndex(input);

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
          resolve(answers[index]);
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

    const bar = new Progress(count, this.stderr);

    bar.render();

    return function() {
      bar.tick();
    };
  }
}
