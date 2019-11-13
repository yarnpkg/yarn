/* @flow */

import {NoopReporter} from '../../src/reporters/index.js';
import {run as buildRun} from './_helpers.js';
import * as auditModule from '../../src/cli/commands/audit.js';
import {run as audit} from '../../src/cli/commands/audit.js';
import {promisify} from '../../src/util/promise.js';
import * as lockfileModule from '../../src/lockfile/index.js';
import * as installModule from '../../src/cli/commands/install.js';

const path = require('path');
const zlib = require('zlib');
const gunzip = promisify(zlib.gunzip);

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'audit');

const setupMockRequestManager = function(config) {
  const apiResponse = JSON.stringify(getAuditResponse(config), null, 2);
  // $FlowFixMe
  config.requestManager.request = jest.fn();
  config.requestManager.request.mockReturnValue(
    new Promise(resolve => {
      resolve(apiResponse);
    }),
  );
};

const setupMockReporter = function(reporter) {
  // $FlowFixMe
  reporter.auditAdvisory = jest.fn();
  // $FlowFixMe
  reporter.auditAction = jest.fn();
  // $FlowFixMe
  reporter.auditSummary = jest.fn();
};

const getAuditResponse = function(config): Object {
  // $FlowFixMe
  return require(path.join(config.cwd, 'audit-api-response.json'));
};

const runAudit = buildRun.bind(
  null,
  NoopReporter,
  fixturesLoc,
  async (args, flags, config, reporter, lockfile, getStdout): Promise<string> => {
    setupMockRequestManager(config);
    setupMockReporter(reporter);
    await audit(config, reporter, flags, args);
    return getStdout();
  },
);

test.concurrent('sends correct dependency map to audit api for single dependency.', () => {
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
        dev: false,
      },
      'brace-expansion': {
        version: '1.1.11',
        integrity: 'sha512-iCuPHDFgrHX7H2vEI/5xpz07zSHB00TpugqhmYtVmMO6518mCuRMoOYFldEBl0g187ufozdaHgWKcYFb61qGiA==',
        requires: {
          'balanced-match': '^1.0.0',
          'concat-map': '0.0.1',
        },
        dependencies: {},
        dev: false,
      },
      'balanced-match': {
        version: '1.0.0',
        integrity: 'sha1-ibTRmasr7kneFk6gK4nORi1xt2c=',
        requires: {},
        dependencies: {},
        dev: false,
      },
      'concat-map': {
        version: '0.0.1',
        integrity: 'sha1-2Klr13/Wjfd5OnMDajug1UBdR3s=',
        requires: {},
        dependencies: {},
        dev: false,
      },
    },
    version: '0.0.0',
    dev: false,
  };

  return runAudit([], {}, 'single-vulnerable-dep-installed', async config => {
    const calledWithPipe = config.requestManager.request.mock.calls[0][0].body;
    const calledWith = JSON.parse(await gunzip(calledWithPipe));
    expect(calledWith).toEqual(expectedApiPost);
  });
});

test('audit groups dependencies does not affect requires', () => {
  const expectedApiPost = {
    name: 'yarn-test',
    install: [],
    remove: [],
    metadata: {},
    dev: false,
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
        dev: false,
      },
      'brace-expansion': {
        version: '1.1.11',
        integrity: 'sha512-iCuPHDFgrHX7H2vEI/5xpz07zSHB00TpugqhmYtVmMO6518mCuRMoOYFldEBl0g187ufozdaHgWKcYFb61qGiA==',
        requires: {
          'balanced-match': '^1.0.0',
          'concat-map': '0.0.1',
        },
        dependencies: {},
        dev: false,
      },
      'balanced-match': {
        version: '1.0.0',
        integrity: 'sha1-ibTRmasr7kneFk6gK4nORi1xt2c=',
        requires: {},
        dependencies: {},
        dev: false,
      },
      'concat-map': {
        version: '0.0.1',
        integrity: 'sha1-2Klr13/Wjfd5OnMDajug1UBdR3s=',
        requires: {},
        dependencies: {},
        dev: false,
      },
    },
    version: '0.0.0',
  };

  return runAudit([], {groups: ['dependencies']}, 'single-vulnerable-dep-installed', async config => {
    const calledWithPipe = config.requestManager.request.mock.calls[0][0].body;
    const calledWith = JSON.parse(await gunzip(calledWithPipe));
    expect(calledWith).toEqual(expectedApiPost);
  });
});

test('audit groups only devDependencies omits dependencies from requires', () => {
  const expectedApiPost = {
    name: 'yarn-test',
    install: [],
    remove: [],
    metadata: {},
    requires: {},
    dev: false,
    dependencies: {
      minimatch: {
        version: '3.0.0',
        integrity: 'sha1-UjYVelHk8ATBd/s8Un/33Xjw74M=',
        requires: {
          'brace-expansion': '^1.0.0',
        },
        dev: false,
        dependencies: {},
      },
      'brace-expansion': {
        version: '1.1.11',
        integrity: 'sha512-iCuPHDFgrHX7H2vEI/5xpz07zSHB00TpugqhmYtVmMO6518mCuRMoOYFldEBl0g187ufozdaHgWKcYFb61qGiA==',
        requires: {
          'balanced-match': '^1.0.0',
          'concat-map': '0.0.1',
        },
        dev: false,
        dependencies: {},
      },
      'balanced-match': {
        version: '1.0.0',
        integrity: 'sha1-ibTRmasr7kneFk6gK4nORi1xt2c=',
        requires: {},
        dev: false,
        dependencies: {},
      },
      'concat-map': {
        version: '0.0.1',
        integrity: 'sha1-2Klr13/Wjfd5OnMDajug1UBdR3s=',
        requires: {},
        dev: false,
        dependencies: {},
      },
    },
    version: '0.0.0',
  };

  return runAudit([], {groups: ['devDependencies']}, 'single-vulnerable-dep-installed', async config => {
    const calledWithPipe = config.requestManager.request.mock.calls[0][0].body;
    const calledWith = JSON.parse(await gunzip(calledWithPipe));
    expect(calledWith).toEqual(expectedApiPost);
  });
});

test('calls reporter auditAdvisory when using --level high flag', () => {
  return runAudit([], {level: 'high'}, 'single-vulnerable-dep-installed', (config, reporter) => {
    const apiResponse = getAuditResponse(config);
    expect(reporter.auditAdvisory).toBeCalledWith(apiResponse.actions[0].resolves[0], apiResponse.advisories['118']);
  });
});

test(`doesn't call reporter auditAdvisory when using --level critical flag`, () => {
  return runAudit([], {level: 'critical'}, 'single-vulnerable-dep-installed', (config, reporter) => {
    getAuditResponse(config);
    expect(reporter.auditAdvisory).not.toHaveBeenCalled();
  });
});

test('calls reporter auditAdvisory with correct data', () => {
  return runAudit([], {}, 'single-vulnerable-dep-installed', (config, reporter) => {
    const apiResponse = getAuditResponse(config);
    expect(reporter.auditAdvisory).toBeCalledWith(apiResponse.actions[0].resolves[0], apiResponse.advisories['118']);
  });
});

// *** Test temporarily removed due to inability to correctly suggest actions to the user.
// test('calls reporter auditAction with correct data', () => {
//   return runAudit([], {}, 'single-vulnerable-dep-installed', (config, reporter) => {
//     const apiResponse = getAuditResponse(config);
//     expect(reporter.auditAction).toBeCalledWith({
//       cmd: 'yarn upgrade minimatch@3.0.4',
//       isBreaking: false,
//       action: apiResponse.actions[0],
//     });
//   });
// });

test('calls reporter auditSummary with correct data', () => {
  return runAudit([], {}, 'single-vulnerable-dep-installed', (config, reporter) => {
    const apiResponse = getAuditResponse(config);
    expect(reporter.auditSummary).toBeCalledWith(apiResponse.metadata);
  });
});

test.concurrent('sends correct dependency map to audit api for private package.', () => {
  const expectedApiPost = {
    install: [],
    remove: [],
    metadata: {},
    requires: {
      'left-pad': '^1.3.0',
    },
    dependencies: {
      'left-pad': {
        version: '1.3.0',
        integrity: 'sha512-XI5MPzVNApjAyhQzphX8BkmKsKUxD4LdyK24iZeQGinBN9yTQT3bFlCBy/aVx2HrNcqQGsdot8ghrjyrvMCoEA==',
        requires: {},
        dependencies: {},
        dev: false,
      },
    },
    dev: false,
  };

  return runAudit([], {}, 'private-package', async config => {
    const calledWithPipe = config.requestManager.request.mock.calls[0][0].body;
    const calledWith = JSON.parse(await gunzip(calledWithPipe));
    expect(calledWith).toEqual(expectedApiPost);
  });
});

test('calls reporter auditAdvisory with correct data for private package', () => {
  return runAudit([], {}, 'single-vulnerable-dep-installed', (config, reporter) => {
    const apiResponse = getAuditResponse(config);
    expect(reporter.auditAdvisory).toBeCalledWith(apiResponse.actions[0].resolves[0], apiResponse.advisories['118']);
  });
});

test('calls reporter auditSummary with correct data for private package', () => {
  return runAudit([], {}, 'single-vulnerable-dep-installed', (config, reporter) => {
    const apiResponse = getAuditResponse(config);
    expect(reporter.auditSummary).toBeCalledWith(apiResponse.metadata);
  });
});

test.concurrent('distinguishes dev and prod transitive dependencies in audit request and result', () => {
  const expectedApiPost = {
    name: 'foo',
    version: '1.0.0',
    install: [],
    remove: [],
    metadata: {},
    requires: {
      mime: '1.4.0',
      hoek: '4.2.0',
    },
    dependencies: {
      mime: {
        version: '1.4.0',
        integrity: 'sha512-n9ChLv77+QQEapYz8lV+rIZAW3HhAPW2CXnzb1GN5uMkuczshwvkW7XPsbzU0ZQN3sP47Er2KVkp2p3KyqZKSQ==',
        requires: {},
        dependencies: {},
        dev: false,
      },
      hoek: {
        version: '4.2.0',
        integrity: 'sha512-v0XCLxICi9nPfYrS9RL8HbYnXi9obYAeLbSP00BmnZwCK9+Ih9WOjoZ8YoHCoav2csqn4FOz4Orldsy2dmDwmQ==',
        requires: {},
        dependencies: {},
        dev: true,
      },
    },
    dev: false,
  };

  return runAudit([], {}, 'dev-and-prod-vulnerabilities', async (config, reporter) => {
    const calledWithPipe = config.requestManager.request.mock.calls[0][0].body;
    const calledWith = JSON.parse(await gunzip(calledWithPipe));
    expect(calledWith).toEqual(expectedApiPost);

    const apiResponse = getAuditResponse(config);
    expect(reporter.auditSummary).toBeCalledWith(apiResponse.metadata);
  });
});

describe('returns semantic exit codes', () => {
  let lockfileSpy;
  let installSpy;

  beforeAll(() => {
    // mock unrelated stuff
    lockfileSpy = jest.spyOn(lockfileModule.default, 'fromDirectory').mockImplementation(jest.fn());
    installSpy = jest.spyOn(installModule, 'Install').mockImplementation(() => {
      return {
        fetchRequestFromCwd: jest.fn(() => {
          return {};
        }),
        resolver: {
          init: jest.fn(),
        },
        linker: {
          init: jest.fn(),
        },
      };
    });
  });

  afterAll(() => {
    lockfileSpy.mockRestore();
    installSpy.mockRestore();
  });

  const exitCodeTestCases = [
    [0, {}, 'zero when no vulnerabilities'],
    [1, {info: 77}, '1 for info'],
    [2, {low: 77}, '2 for low'],
    [4, {moderate: 77}, '4 for moderate'],
    [8, {high: 77}, '8 for high'],
    [16, {critical: 77}, '16 for critical'],
    [17, {info: 55, critical: 77}, 'different categories sum up'],
  ];
  exitCodeTestCases.forEach(([expectedExitCode, foundVulnerabilities, description]) => {
    test(description, async () => {
      const spy = jest.spyOn(auditModule.default.prototype, 'performAudit').mockImplementation(() => {
        return foundVulnerabilities;
      });

      const configMock: any = {};
      const reporterMock: any = {};
      const exitCode = await audit(configMock, reporterMock, {}, []);
      expect(exitCode).toEqual(expectedExitCode);

      spy.mockRestore();
    });
  });
});

test.concurrent('sends correct dependency map to audit api for workspaces.', () => {
  const expectedApiPost = {
    dependencies: {
      'balanced-match': {
        dependencies: {},
        dev: false,
        integrity: 'sha1-ibTRmasr7kneFk6gK4nORi1xt2c=',
        requires: {},
        version: '1.0.0',
      },
      'brace-expansion': {
        dependencies: {},
        dev: false,
        integrity: 'sha512-iCuPHDFgrHX7H2vEI/5xpz07zSHB00TpugqhmYtVmMO6518mCuRMoOYFldEBl0g187ufozdaHgWKcYFb61qGiA==',
        requires: {
          'balanced-match': '^1.0.0',
          'concat-map': '0.0.1',
        },
        version: '1.1.11',
      },
      'concat-map': {
        dependencies: {},
        dev: false,
        integrity: 'sha1-2Klr13/Wjfd5OnMDajug1UBdR3s=',
        requires: {},
        version: '0.0.1',
      },
      minimatch: {
        dependencies: {},
        dev: false,
        integrity: 'sha1-UjYVelHk8ATBd/s8Un/33Xjw74M=',
        requires: {
          'brace-expansion': '^1.0.0',
        },
        version: '3.0.0',
      },
      prj1: {
        dependencies: {},
        dev: false,
        integrity: '',
        requires: {
          minimatch: '3.0.0',
        },
        version: '0.0.0',
      },
    },
    install: [],
    metadata: {},
    name: 'yarn-test',
    remove: [],
    requires: {
      prj1: '0.0.0',
    },
    version: '1.0.0',
    dev: false,
  };

  return runAudit([], {}, 'workspace', async config => {
    const calledWithPipe = config.requestManager.request.mock.calls[0][0].body;
    const calledWith = JSON.parse(await gunzip(calledWithPipe));
    expect(calledWith).toEqual(expectedApiPost);
  });
});
