/* @flow */

import type {CLIFunctionReturn} from '../../src/types.js';
import * as reporters from '../../src/reporters/index.js';
import * as importCmd from '../../src/cli/commands/import.js';
import Lockfile from '../../src/lockfile';
import * as fs from '../../src/util/fs.js';
import {run as buildRun} from './_helpers.js';
import semver from 'semver';

const YARN_VERSION_REGEX = /yarn v\S+/;
const YARN_VERSION = require('../../package.json').version;
const NODE_VERSION_REGEX = /node \S+/;
const NODE_VERSION = process.version;
const nodeVersion = process.versions.node.split('-')[0];

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'import');

const runImport = buildRun.bind(
  null,
  reporters.BufferReporter,
  fixturesLoc,
  (args, flags, config, reporter): CLIFunctionReturn => {
    return importCmd.run(config, reporter, flags, args);
  },
);

const reporterType = (reporter, type) => reporter.getBuffer().filter(d => d.type === type);

const reporterErrors = reporter => reporter.getBuffer().filter(d => d.error);

const checkReporter = (reporter, importFrom) => {
  expect(reporterErrors(reporter)).toEqual([]);
  if (importFrom === 'package-lock.json') {
    expect(reporterType(reporter, 'info')).toEqual([
      {data: reporter.lang('importPackageLock'), error: false, type: 'info'},
    ]);
  } else {
    expect(reporterType(reporter, 'info')).toEqual([
      {data: reporter.lang('importNodeModules'), error: false, type: 'info'},
    ]);
  }
};

const checkLockfile = async (config, reporter) => {
  const lockfile = await Lockfile.fromDirectory(config.lockfileFolder, reporter);

  const imported = await fs.readFile(path.join(config.cwd, 'yarn.lock.import'));
  expect(lockfile.source).toEqual(imported);
};

const checkLockfileWithVersions = async (config, reporter) => {
  const lockfile = await Lockfile.fromDirectory(config.lockfileFolder, reporter);

  let imported = await fs.readFile(path.join(config.cwd, 'yarn.lock.import'));
  // Since the version changes, we need to account for that
  imported = imported.replace(YARN_VERSION_REGEX, `yarn v${YARN_VERSION}`);
  imported = imported.replace(NODE_VERSION_REGEX, `node ${NODE_VERSION}`);
  expect(lockfile.source).toEqual(imported);
};

const checkReporterAndLockfile = ({importFrom}) => async (config, reporter) => {
  checkReporter(reporter, importFrom);
  await checkLockfile(config, reporter);
  checkReporter(reporter, importFrom);
};

test.concurrent('import shallow deps', () => {
  const importFrom = 'node_modules';
  return runImport([], {}, 'shallow', checkReporterAndLockfile({importFrom}));
});

test.concurrent('import deep deps', () => {
  const importFrom = 'node_modules';
  return runImport([], {}, 'deep', checkReporterAndLockfile({importFrom}));
});

test.concurrent('import shallow dev deps', () => {
  const importFrom = 'node_modules';
  return runImport([], {}, 'shallow-dev', checkReporterAndLockfile({importFrom}));
});

test.concurrent('import github deps', () => {
  const importFrom = 'node_modules';
  return runImport([], {}, 'github', checkReporterAndLockfile({importFrom}));
});

test.concurrent('import file deps', () => {
  const importFrom = 'node_modules';
  return runImport([], {}, 'file', checkReporterAndLockfile({importFrom}));
});

test.concurrent('import overlapping semver ranges successfully', () => {
  const importFrom = 'node_modules';
  return runImport([], {}, 'overlapping', checkReporterAndLockfile({importFrom}));
});

test.concurrent('throw on missing dev deps', async () => {
  let thrown = false;
  try {
    await runImport([], {}, 'missing-dev');
  } catch (err) {
    thrown = true;
  }
  expect(thrown).toBeTruthy();
});

test.concurrent('including Yarn and Node version in yarn.lock', () => {
  return runImport([], {production: true}, 'versions-yarn-lock', async (config, reporter) => {
    await checkLockfileWithVersions(config, reporter);
  });
});

test.concurrent('import missing dev deps in production', () => {
  return runImport([], {production: true}, 'missing-dev', async (config, reporter) => {
    expect(reporterErrors(reporter).length).toEqual(1);
    expect(reporterType(reporter, 'warning').length).toEqual(1);
    await checkLockfile(config, reporter);
    expect(reporterErrors(reporter).length).toEqual(1);
    expect(reporterType(reporter, 'warning').length).toEqual(1);
  });
});

test.concurrent('import missing opt deps', () => {
  return runImport([], {}, 'missing-opt', async (config, reporter) => {
    expect(reporterErrors(reporter).length).toEqual(1);
    expect(reporterType(reporter, 'warning').length).toEqual(1);
    await checkLockfile(config, reporter);
    expect(reporterErrors(reporter).length).toEqual(1);
    expect(reporterType(reporter, 'warning').length).toEqual(1);
  });
});

test.concurrent('throw when yarn.lock exists', async () => {
  let thrown = false;
  try {
    await runImport([], {}, 'locked');
  } catch (err) {
    thrown = true;
  }
  expect(thrown).toBeTruthy();
});

if (semver.satisfies(nodeVersion, '>=5.0.0')) {
  test.concurrent('import shallow deps from package-lock.json', () => {
    const importFrom = 'package-lock.json';
    return runImport([], {}, 'shallow-package-lock', checkReporterAndLockfile({importFrom}));
  });

  test.concurrent('import deep deps from package-lock.json', () => {
    const importFrom = 'package-lock.json';
    return runImport([], {}, 'deep-package-lock', checkReporterAndLockfile({importFrom}));
  });

  test.concurrent('import shallow dev deps from package-lock.json', () => {
    const importFrom = 'package-lock.json';
    return runImport([], {}, 'shallow-dev-package-lock', checkReporterAndLockfile({importFrom}));
  });

  test.concurrent('import github deps from package-lock.json', () => {
    const importFrom = 'package-lock.json';
    return runImport([], {}, 'github-package-lock', checkReporterAndLockfile({importFrom}));
  });

  test.concurrent('import file deps from package-lock.json', () => {
    const importFrom = 'package-lock.json';
    return runImport([], {}, 'file-package-lock', checkReporterAndLockfile({importFrom}));
  });

  test.concurrent('import overlapping semver ranges from package-lock.json successfully', () => {
    const importFrom = 'package-lock.json';
    return runImport([], {}, 'overlapping-package-lock', checkReporterAndLockfile({importFrom}));
  });

  test.concurrent('throw on corrupted package-lock.json', async () => {
    let thrown = false;
    try {
      await runImport([], {}, 'corrupted-package-lock');
    } catch (err) {
      thrown = true;
    }
    expect(thrown).toBeTruthy();
  });

  test.concurrent(
    'throw on corrupted package-lock.json - missing dependencies (package-lock.json inconsistent)',
    async () => {
      let thrown = false;
      try {
        await runImport([], {}, 'corrupted-package-lock-missing-deps');
      } catch (err) {
        thrown = true;
      }
      expect(thrown).toBeTruthy();
    },
  );

  test.concurrent('import uncorrupted (consistent) package-lock.json with missing dependencies', () => {
    return runImport([], {}, 'package-lock-missing-deps', async (config, reporter) => {
      const errors = reporterErrors(reporter);
      await checkLockfile(config, reporter);
      expect(errors).toEqual([
        {
          type: 'warning',
          data: 'Import of "os-homedir@^1.0.0" for "package-lock-missing-deps > user-home" failed, resolving normally.',
          error: true,
        },
      ]);
    });
  });

  test.concurrent('including Yarn and Node version in yarn.lock from package-lock.json', () => {
    return runImport([], {production: true}, 'versions-yarn-lock-package-lock', async (config, reporter) => {
      await checkLockfileWithVersions(config, reporter);
    });
  });
}
