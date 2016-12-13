/* @flow */

jest.mock('opn');

import {run as docs, setFlags} from '../../src/cli/commands/docs.js';
import {BufferReporter} from '../../src/reporters/index.js';
import Config from '../../src/config.js';
import path from 'path';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'docs');

async function runDocs(
  args: Array<string>,
  flags: Object,
  name: string,
  mockResponse: ?Object,
  checkSteps?: ?(mocks: Object, output: any) => ?Promise<void>,
): Promise<void> {
  // $FlowFixMe: Update our jest flow-type
  jest.clearAllMocks();
  const reporter = new BufferReporter({stdout: null, stdin: null});
  const config = new Config(reporter);
  const cwd = name && path.join(fixturesLoc, name);
  await config.init({cwd});
  const mocks = {
    opn: require('opn'),
    request: jest.fn(() => mockResponse),
  };
  config.registries = {npm:{request: mocks.request}};
  await docs(config, reporter, flags, args);

  if (checkSteps) {
    const buffer = reporter.getBuffer();
    const output = buffer.pop().data;
    await checkSteps(mocks, output);
  }
}

const testData = {
  'without arguments and in directory containing a valid package file':
    [[], {}, 'valid', {}],
  'without arguments and in directory containing a invalid package file':
    [[], {}, 'invalid', {}],
  'with 1 argument and a invalid request':
    [['jest'], {}, 'valid', null],
  'with 1 argument and a valid request':
    [['jest'], {}, 'valid', {name: 'jest'}],
  'with 1 argument, a valid request, and a homepage':
    [['jest'], {}, 'valid', {name: 'jest', homepage: 'http://example.com'}],
  'with 1 argument, an app passed in, a valid request, and a homepage':
    [['jest'], {app: 'Google Chrome'}, 'valid', {name: 'jest', homepage: 'http://example.com'}],
  'with multiple arguments and a valid request':
    [['jest', 'foo'], {}, 'valid', {name: 'jest'}],
};

Object.keys(testData).forEach((testDescription) => {
  const testArgs = testData[testDescription];
  const [args, flags, name, mockResponse] = testArgs;
  test(testDescription, (): Promise<void> => {
    return runDocs(args, flags, name, mockResponse,
      ({opn, request}, output): ?Promise<void> => {
        expect(opn.mock).toMatchSnapshot();
        expect(request.mock).toMatchSnapshot();
        expect(output).toMatchSnapshot();
      },
    );
  });
});

test('setFlags() modifies our commander object', () => {
  // $FlowFixMe: Update our jest flow-type
  const commander = jest.fn();
  // $FlowFixMe: Update our jest flow-type
  commander.usage = jest.fn();
  // $FlowFixMe: Update our jest flow-type
  commander.option = jest.fn();
  setFlags(commander);
  // $FlowFixMe: Update our jest flow-type
  expect(commander.usage.mock).toMatchSnapshot();
  // $FlowFixMe: Update our jest flow-type
  expect(commander.option.mock).toMatchSnapshot();
});
