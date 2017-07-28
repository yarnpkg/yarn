/* @flow */
import type {QuestionOptions} from './types.js';
import BaseReporter from './base-reporter.js';

export default class TestReporter extends BaseReporter {
  constructor(opts: Object) {
    super({});
    this._questionMap = opts;
  }

  question(question: string, options?: QuestionOptions = {}): Promise<string> {
    const parsedQuestion = question.replace(/ \((.*?)\)/g, '');
    if (parsedQuestion in this._questionMap) {
      return new Promise((resolve, reject) => {
        resolve(this._questionMap[parsedQuestion]); // Resolve to answer
      });
    }

    return Promise.reject(new Error(`Question not found in question-answer map ${parsedQuestion}`));
  }

  _questionMap: Object;
}
