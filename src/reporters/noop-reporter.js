/* @flow */
/* eslint no-unused-vars: 0 */

import type {
  ReporterSpinnerSet,
  ReporterSelectOption,
  Trees,
  Package,
  ReporterSpinner,
  QuestionOptions,
  PromptOptions,
} from './types.js';
import type {LanguageKeys} from './lang/en.js';
import type {Formatter} from './format.js';
import BaseReporter from './base-reporter.js';

export default class NoopReporter extends BaseReporter {
  lang(key: LanguageKeys, ...args: Array<mixed>): string {
    return 'do nothing';
  }
  verbose(msg: string) {}
  verboseInspect(val: any) {}
  initPeakMemoryCounter() {}
  checkPeakMemory() {}
  close() {}
  getTotalTime(): number {
    return 0;
  }
  list(key: string, items: Array<string>, hints?: Object) {}
  tree(key: string, obj: Trees) {}
  step(current: number, total: number, message: string, emoji?: string) {}
  error(message: string) {}
  info(message: string) {}
  warn(message: string) {}
  success(message: string) {}
  log(message: string) {}
  command(command: string) {}
  inspect(value: any) {}
  header(command: string, pkg: Package) {}
  footer(showPeakMemory: boolean) {}
  table(head: Array<string>, body: Array<Array<string>>) {}

  activity(): ReporterSpinner {
    return {
      tick(name: string) {},
      end() {},
    };
  }

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

  question(question: string, options?: QuestionOptions = {}): Promise<string> {
    return Promise.reject(new Error('Not implemented'));
  }

  async questionAffirm(question: string): Promise<boolean> {
    await this.question(question);
    return false;
  }

  select(header: string, question: string, options: Array<ReporterSelectOption>): Promise<string> {
    return Promise.reject(new Error('Not implemented'));
  }

  progress(total: number): () => void {
    return function() {};
  }

  disableProgress() {
    this.noProgress = true;
  }

  prompt<T>(message: string, choices: Array<*>, options?: PromptOptions = {}): Promise<Array<T>> {
    return Promise.reject(new Error('Not implemented'));
  }
}
