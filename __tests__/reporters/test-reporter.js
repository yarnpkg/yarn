/* @flow */
/* eslint yarn-internal/warn-language: 0 */
import TestReporter from '../../src/reporters/test-reporter.js';

test.concurrent('TestReporter.question', async (): Promise<void> => {
  const questionMap = {
    ping: 'pong',
  };
  const reporter = new TestReporter(questionMap);
  expect(await reporter.question('ping')).toEqual('pong');
});
