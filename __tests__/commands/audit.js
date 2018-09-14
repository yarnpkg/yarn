/* @flow */

import {ConsoleReporter} from '../../src/reporters/index.js';
import {run as buildRun} from './_helpers.js';
import {run as audit} from '../../src/cli/commands/audit.js';

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'audit');

const setupMocks = function(config, apiResponse) {
  // $FlowFixMe
  config.requestManager.request = jest.fn();
  config.requestManager.request.mockReturnValue(
    new Promise(resolve => {
      resolve(apiResponse);
    }),
  );
};

const runAudit = function(apiResponse, ...args): Promise<void> {
  return buildRun(
    ConsoleReporter,
    fixturesLoc,
    async (args, flags, config, reporter, lockfile, getStdout): Promise<string> => {
      setupMocks(config, apiResponse);
      await audit(config, reporter, flags, args);
      return getStdout();
    },
    ...args,
  );
};

test.concurrent('sends correct dependency map to audit api for single dependency.', () => {
  const apiResponse = {
    actions: [],
    advisories: {},
    muted: [],
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: 0,
        critical: 0,
      },
      dependencies: 4,
      devDependencies: 0,
      optionalDependencies: 0,
      totalDependencies: 4,
    },
  };

  const expectedApiPost = {
    name: 'yarn-test',
    install: [],
    remove: [],
    metadata: {},
    requires: {
      minimatch: '^3.0.0',
    },
    dependencies: {
      minimatch: {
        version: '3.0.0',
        integrity: 'sha1-UjYVelHk8ATBd/s8Un/33Xjw74M=',
        requires: {
          'brace-expansion': '^1.0.0',
        },
        dependencies: {},
      },
      'brace-expansion': {
        version: '1.1.11',
        integrity: 'sha512-iCuPHDFgrHX7H2vEI/5xpz07zSHB00TpugqhmYtVmMO6518mCuRMoOYFldEBl0g187ufozdaHgWKcYFb61qGiA==',
        requires: {
          'balanced-match': '^1.0.0',
          'concat-map': '0.0.1',
        },
        dependencies: {},
      },
      'balanced-match': {
        version: '1.0.0',
        integrity: 'sha1-ibTRmasr7kneFk6gK4nORi1xt2c=',
        requires: {},
        dependencies: {},
      },
      'concat-map': {
        version: '0.0.1',
        integrity: 'sha1-2Klr13/Wjfd5OnMDajug1UBdR3s=',
        requires: {},
        dependencies: {},
      },
    },
    version: '0.0.0',
  };

  return runAudit(apiResponse, [], {}, 'single-vulnerable-dep-installed', config => {
    expect(config.requestManager.request).toBeCalledWith(
      expect.objectContaining({
        body: expectedApiPost,
      }),
    );
  });
});
