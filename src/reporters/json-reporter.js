/* @flow */

import type {ReporterSpinnerSet, Trees, ReporterSpinner} from './types.js';
import type {AuditMetadata, AuditActionRecommendation, AuditAdvisory, AuditResolution} from '../cli/commands/audit';
import BaseReporter from './base-reporter.js';
import type {ReporterSelectOption} from './types';

export default class JSONReporter extends BaseReporter {
  constructor(opts?: Object) {
    super(opts);

    this._activityId = 0;
    this._progressId = 0;
  }

  _activityId: number;
  _progressId: number;

  _dump(type: string, data: mixed, error?: boolean) {
    let stdout = this.stdout;
    if (error) {
      stdout = this.stderr;
    }
    stdout.write(`${JSON.stringify({type, data})}\n`);
  }

  _verbose(msg: string) {
    this._dump('verbose', msg);
  }

  list(type: string, items: Array<string>, hints?: Object) {
    this._dump('list', {type, items, hints});
  }

  tree(type: string, trees: Trees) {
    this._dump('tree', {type, trees});
  }

  step(current: number, total: number, message: string) {
    this._dump('step', {message, current, total});
  }

  inspect(value: mixed) {
    this._dump('inspect', value);
  }

  footer(showPeakMemory: boolean) {
    this._dump('finished', this.getTotalTime());
  }

  log(msg: string) {
    this._dump('log', msg);
  }

  command(msg: string) {
    this._dump('command', msg);
  }

  table(head: Array<string>, body: Array<Array<string>>) {
    this._dump('table', {head, body});
  }

  success(msg: string) {
    this._dump('success', msg);
  }

  error(msg: string) {
    this._dump('error', msg, true);
  }

  warn(msg: string) {
    this._dump('warning', msg, true);
  }

  info(msg: string) {
    this._dump('info', msg);
  }

  activitySet(total: number, workers: number): ReporterSpinnerSet {
    if (!this.isTTY || this.noProgress) {
      return super.activitySet(total, workers);
    }

    const id = this._activityId++;
    this._dump('activitySetStart', {id, total, workers});

    const spinners = [];
    for (let i = 0; i < workers; i++) {
      let current = 0;
      let header = '';

      spinners.push({
        clear() {},
        setPrefix(_current: number, _header: string) {
          current = _current;
          header = _header;
        },
        tick: msg => {
          this._dump('activitySetTick', {
            id,
            header,
            current,
            worker: i,
            message: msg,
          });
        },
        end() {},
      });
    }

    return {
      spinners,
      end: () => {
        this._dump('activitySetEnd', {id});
      },
    };
  }

  activity(): ReporterSpinner {
    return this._activity({});
  }

  _activity(data: Object): ReporterSpinner {
    if (!this.isTTY || this.noProgress) {
      return {
        tick() {},
        end() {},
      };
    }

    const id = this._activityId++;
    this._dump('activityStart', {id, ...data});

    return {
      tick: (name: string) => {
        this._dump('activityTick', {id, name});
      },

      end: () => {
        this._dump('activityEnd', {id});
      },
    };
  }

  _readline(): Promise<any> {
    let inputHandler;
    const cleanup = () => {
      process.stdin.read();
      process.stdin.removeListener('readable', inputHandler);
    };
    return new Promise((resolve, reject) => {
      inputHandler = () => {
        let chunk: ?Buffer;
        let buff: Buffer = Buffer.alloc(0);
        // Readable.read may return string, but stdin never do that.
        while ((chunk = (process.stdin.read(1): any)) !== null) {
          const char = chunk[0];
          if (char === 10 || char === 13) {
            if (buff.length === 0) {
              continue;
            }
            try {
              resolve(JSON.parse(buff.toString()));
            } catch (e) {
              reject(e);
            }
            return;
          }
          buff = Buffer.concat([buff, chunk]);
        }
      };
      process.stdin.on('readable', inputHandler);
    }).then(
      line => {
        cleanup();
        return line;
      },
      e => {
        cleanup();
        return Promise.reject(e);
      },
    );
  }

  async select(header: string, question: string, options: Array<ReporterSelectOption>): Promise<string> {
    this._dump('select', {header, question, options}); // header and question is localized

    const line = await this._readline();

    if (line.type !== 'select' || typeof line.answer !== 'number') {
      return Promise.reject(new Error('Invalid answer type'));
    }
    const index = line.answer;
    if (index <= 0 || index > options.length) {
      return Promise.reject(new Error('Outside answer range'));
    }
    const option = options[line.answer];
    if (!option) {
      return Promise.reject(new Error('Invalid choice'));
    }
    this._dump('debug', {selected: option});
    return option.value;
  }

  progress(total: number): () => void {
    if (this.noProgress) {
      return function() {
        // noop
      };
    }

    const id = this._progressId++;
    let current = 0;
    this._dump('progressStart', {id, total});

    return () => {
      current++;
      this._dump('progressTick', {id, current});

      if (current === total) {
        this._dump('progressFinish', {id});
      }
    };
  }

  auditAction(recommendation: AuditActionRecommendation) {
    this._dump('auditAction', recommendation);
  }

  auditAdvisory(resolution: AuditResolution, auditAdvisory: AuditAdvisory) {
    this._dump('auditAdvisory', {resolution, advisory: auditAdvisory});
  }

  auditSummary(auditMetadata: AuditMetadata) {
    this._dump('auditSummary', auditMetadata);
  }
}
