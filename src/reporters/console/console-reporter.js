/* @flow */

import type {
  ReporterSetSpinner,
  ReporterSpinnerSet,
  Package,
  Trees,
  ReporterSpinner,
  ReporterSelectOption,
  QuestionOptions,
  PromptOptions,
} from '../types.js';
import type {FormatKeys} from '../format.js';
import type {AuditMetadata, AuditActionRecommendation, AuditAdvisory, AuditResolution} from '../../cli/commands/audit';

import BaseReporter from '../base-reporter.js';
import Progress from './progress-bar.js';
import Spinner from './spinner-progress.js';
import {clearLine} from './util.js';
import {removeSuffix} from '../../util/misc.js';
import {sortTrees, recurseTree, getFormattedOutput} from './helpers/tree-helper.js';
import inquirer from 'inquirer';
import Table from 'cli-table3';

const {inspect} = require('util');
const readline = require('readline');
const chalk = require('chalk');
const stripAnsi = require('strip-ansi');
const read = require('read');
const tty = require('tty');

const AUDIT_COL_WIDTHS = [15, 62];

const auditSeverityColors = {
  info: chalk.bold,
  low: chalk.bold,
  moderate: chalk.yellow,
  high: chalk.red,
  critical: chalk.bgRed,
};

type Row = Array<string>;
type InquirerResponses<K, T> = {[key: K]: Array<T>};

// fixes bold on windows
if (process.platform === 'win32' && !(process.env.TERM && /^xterm/i.test(process.env.TERM))) {
  chalk.bold._styles[0].close += '\u001b[m';
}

export default class ConsoleReporter extends BaseReporter {
  constructor(opts: Object) {
    super(opts);

    this._lastCategorySize = 0;
    this._spinners = new Set();
    this.format = (chalk: any);
    this.format.stripColor = stripAnsi;
    this.isSilent = !!opts.isSilent;
  }

  _lastCategorySize: number;
  _progressBar: ?Progress;
  _spinners: Set<Spinner>;

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

  _verbose(msg: string) {
    this._logCategory('verbose', 'grey', `${process.uptime()} ${msg}`);
  }

  _verboseInspect(obj: any) {
    this.inspect(obj);
  }

  close() {
    for (const spinner of this._spinners) {
      spinner.stop();
    }
    this._spinners.clear();
    this.stopProgress();
    super.close();
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

        row[i] = field + ' '.repeat(padding);
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

    this.log(`${this.format.dim(`[${current}/${total}]`)} ${msg}`);
  }

  inspect(value: mixed) {
    if (typeof value !== 'number' && typeof value !== 'string') {
      value = inspect(value, {
        breakLength: 0,
        colors: this.isTTY,
        depth: null,
        maxArrayLength: null,
      });
    }

    this.log(String(value), {force: true});
  }

  list(key: string, items: Array<string>, hints?: Object) {
    const gutterWidth = (this._lastCategorySize || 2) - 1;

    if (hints) {
      for (const item of items) {
        this._log(`${' '.repeat(gutterWidth)}- ${this.format.bold(item)}`);
        this._log(`  ${' '.repeat(gutterWidth)} ${hints[item]}`);
      }
    } else {
      for (const item of items) {
        this._log(`${' '.repeat(gutterWidth)}- ${item}`);
      }
    }
  }

  header(command: string, pkg: Package) {
    this.log(this.format.bold(`${pkg.name} ${command} v${pkg.version}`));
  }

  footer(showPeakMemory?: boolean) {
    this.stopProgress();

    const totalTime = (this.getTotalTime() / 1000).toFixed(2);
    let msg = `Done in ${totalTime}s.`;
    if (showPeakMemory) {
      const peakMemory = (this.peakMemory / 1024 / 1024).toFixed(2);
      msg += ` Peak memory usage ${peakMemory}MB.`;
    }
    this.log(this._prependEmoji(msg, '✨'));
  }

  log(msg: string, {force = false}: {force?: boolean} = {}) {
    this._lastCategorySize = 0;
    this._log(msg, {force});
  }

  _log(msg: string, {force = false}: {force?: boolean} = {}) {
    if (this.isSilent && !force) {
      return;
    }
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
    this.log(this.format.dim(`$ ${command}`));
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
      read(
        {
          prompt: `${this.format.dim('question')} ${question}: `,
          silent: !!options.password,
          output: this.stdout,
          input: this.stdin,
        },
        (err, answer) => {
          if (err) {
            if (err.message === 'canceled') {
              process.exitCode = 1;
            }
            reject(err);
          } else {
            if (!answer && options.required) {
              this.error(this.lang('answerRequired'));
              resolve(this.question(question, options));
            } else {
              resolve(answer);
            }
          }
        },
      );
    });
  }
  // handles basic tree output to console
  tree(key: string, trees: Trees, {force = false}: {force?: boolean} = {}) {
    this.stopProgress();
    //
    if (this.isSilent && !force) {
      return;
    }
    const output = ({name, children, hint, color}, titlePrefix, childrenPrefix) => {
      const formatter = this.format;
      const out = getFormattedOutput({
        prefix: titlePrefix,
        hint,
        color,
        name,
        formatter,
      });
      this.stdout.write(out);

      if (children && children.length) {
        recurseTree(sortTrees(children), childrenPrefix, output);
      }
    };
    recurseTree(sortTrees(trees), '', output);
  }

  activitySet(total: number, workers: number): ReporterSpinnerSet {
    if (!this.isTTY || this.noProgress) {
      return super.activitySet(total, workers);
    }

    const spinners: Array<ReporterSetSpinner> = [];
    const reporterSpinners = this._spinners;

    for (let i = 1; i < workers; i++) {
      this.log('');
    }

    for (let i = 0; i < workers; i++) {
      const spinner = new Spinner(this.stderr, i);
      reporterSpinners.add(spinner);
      spinner.start();

      let prefix: ?string = null;
      let current = 0;
      const updatePrefix = () => {
        spinner.setPrefix(`${this.format.dim(`[${current === 0 ? '-' : current}/${total}]`)} `);
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
          reporterSpinners.delete(spinner);
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
    const reporterSpinners = this._spinners;

    const spinner = new Spinner(this.stderr);
    spinner.start();

    reporterSpinners.add(spinner);

    return {
      tick(name: string) {
        spinner.setText(name);
      },

      end() {
        spinner.stop();
        reporterSpinners.delete(spinner);
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

    return new Promise(resolve => {
      this.info(header);

      for (let i = 0; i < questions.length; i++) {
        this.log(`  ${this.format.dim(`${i + 1})`)} ${questions[i]}`);
      }

      const ask = () => {
        rl.question(`${question}: `, input => {
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
    if (this.noProgress || count <= 0) {
      return function() {
        // noop
      };
    }

    if (!this.isTTY) {
      return function() {
        // TODO what should the behaviour here be? we could buffer progress messages maybe
      };
    }

    // Clear any potentially old progress bars
    this.stopProgress();

    const bar = (this._progressBar = new Progress(count, this.stderr, (progress: Progress) => {
      if (progress === this._progressBar) {
        this._progressBar = null;
      }
    }));

    bar.render();

    return function() {
      bar.tick();
    };
  }

  stopProgress() {
    if (this._progressBar) {
      this._progressBar.stop();
    }
  }

  async prompt<T>(message: string, choices: Array<*>, options?: PromptOptions = {}): Promise<Array<T>> {
    if (!process.stdout.isTTY) {
      return Promise.reject(new Error("Can't answer a question unless a user TTY"));
    }

    let pageSize;
    if (process.stdout instanceof tty.WriteStream) {
      pageSize = process.stdout.rows - 2;
    }

    const rl = readline.createInterface({
      input: this.stdin,
      output: this.stdout,
      terminal: true,
    });

    // $FlowFixMe: Need to update the type of Inquirer
    const prompt = inquirer.createPromptModule({
      input: this.stdin,
      output: this.stdout,
    });

    const {name = 'prompt', type = 'input', validate} = options;
    const answers: InquirerResponses<string, T> = await prompt([{name, type, message, choices, pageSize, validate}]);

    rl.close();

    return answers[name];
  }

  auditSummary(auditMetadata: AuditMetadata) {
    const {totalDependencies, vulnerabilities} = auditMetadata;
    const totalVulnerabilities =
      vulnerabilities.info +
      vulnerabilities.low +
      vulnerabilities.moderate +
      vulnerabilities.high +
      vulnerabilities.critical;
    const summary = this.lang(
      'auditSummary',
      totalVulnerabilities > 0 ? this.rawText(chalk.red(totalVulnerabilities.toString())) : totalVulnerabilities,
      totalDependencies,
    );
    this._log(summary);

    if (totalVulnerabilities) {
      const severities = [];
      if (vulnerabilities.info) {
        severities.push(this.lang('auditInfo', vulnerabilities.info));
      }
      if (vulnerabilities.low) {
        severities.push(this.lang('auditLow', vulnerabilities.low));
      }
      if (vulnerabilities.moderate) {
        severities.push(this.lang('auditModerate', vulnerabilities.moderate));
      }
      if (vulnerabilities.high) {
        severities.push(this.lang('auditHigh', vulnerabilities.high));
      }
      if (vulnerabilities.critical) {
        severities.push(this.lang('auditCritical', vulnerabilities.critical));
      }
      this._log(`${this.lang('auditSummarySeverity')} ${severities.join(' | ')}`);
    }
  }

  auditAction(recommendation: AuditActionRecommendation) {
    const label = recommendation.action.resolves.length === 1 ? 'vulnerability' : 'vulnerabilities';
    this._log(
      this.lang(
        'auditResolveCommand',
        this.rawText(chalk.inverse(recommendation.cmd)),
        recommendation.action.resolves.length,
        this.rawText(label),
      ),
    );
    if (recommendation.isBreaking) {
      this._log(this.lang('auditSemverMajorChange'));
    }
  }

  auditManualReview() {
    const tableOptions = {
      colWidths: [78],
    };
    const table = new Table(tableOptions);
    table.push([
      {
        content: this.lang('auditManualReview'),
        vAlign: 'center',
        hAlign: 'center',
      },
    ]);

    this._log(table.toString());
  }

  auditAdvisory(resolution: AuditResolution, auditAdvisory: AuditAdvisory) {
    function colorSeverity(severity: string, message: ?string): string {
      return auditSeverityColors[severity](message || severity);
    }

    function makeAdvisoryTableRow(patchedIn: ?string): Array<Object> {
      const patchRows = [];

      if (patchedIn) {
        patchRows.push({'Patched in': patchedIn});
      }

      return [
        {[chalk.bold(colorSeverity(auditAdvisory.severity))]: chalk.bold(auditAdvisory.title)},
        {Package: auditAdvisory.module_name},
        ...patchRows,
        {'Dependency of': `${resolution.path.split('>')[0]} ${resolution.dev ? '[dev]' : ''}`},
        {Path: resolution.path.split('>').join(' > ')},
        {'More info': `https://nodesecurity.io/advisories/${auditAdvisory.id}`},
      ];
    }

    const tableOptions = {
      colWidths: AUDIT_COL_WIDTHS,
      wordWrap: true,
    };
    const table = new Table(tableOptions);
    const patchedIn =
      auditAdvisory.patched_versions.replace(' ', '') === '<0.0.0'
        ? 'No patch available'
        : auditAdvisory.patched_versions;
    table.push(...makeAdvisoryTableRow(patchedIn));
    this._log(table.toString());
  }
}
