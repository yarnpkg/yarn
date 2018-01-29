/* @flow */

import {run as buildRun} from './_helpers.js';
import {run as publish} from '../../src/cli/commands/publish.js';
import {ConsoleReporter} from '../../src/reporters/index.js';

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'publish');

const runPublish = buildRun.bind(
  null,
  ConsoleReporter,
  fixturesLoc,
  async (args, flags, config, reporter, lockfile, getStdout): Promise<string> => {
    // $FlowFixMe
    config.registries.npm.request = jest.fn();
    config.registries.npm.request.mockReturnValue(
      new Promise(resolve => {
        resolve({status: 200});
      }),
    );
    await publish(config, reporter, flags, args);
    return getStdout();
  },
);

test.concurrent('publish should default access to undefined', () => {
  return runPublish([], {newVersion: '0.0.1'}, 'minimal', config => {
    const requestCallParams = config.registries.npm.request.mock.calls[0][1];
    expect(requestCallParams.body.access).toEqual(undefined);
  });
});

test.concurrent('publish should accept `--access restricted` argument', () => {
  return runPublish([], {newVersion: '0.0.1', access: 'restricted'}, 'minimal', config => {
    const requestCallParams = config.registries.npm.request.mock.calls[0][1];
    expect(requestCallParams.body.access).toEqual('restricted');
  });
});

test.concurrent('publish should accept `--access public` argument', () => {
  return runPublish([], {newVersion: '0.0.1', access: 'public'}, 'minimal', config => {
    const requestCallParams = config.registries.npm.request.mock.calls[0][1];
    expect(requestCallParams.body.access).toEqual('public');
  });
});

test.concurrent('publish should use publishConfig.access in package manifest', () => {
  return runPublish([], {newVersion: '0.0.1'}, 'public', config => {
    const requestCallParams = config.registries.npm.request.mock.calls[0][1];
    expect(requestCallParams.body.access).toEqual('public');
  });
});

test.concurrent('publish should allow `--access` to override publishConfig.access', () => {
  return runPublish([], {newVersion: '0.0.1', access: 'restricted'}, 'public', config => {
    const requestCallParams = config.registries.npm.request.mock.calls[0][1];
    expect(requestCallParams.body.access).toEqual('restricted');
  });
});
