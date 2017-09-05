/* @flow */

import type {CLIFunctionReturn} from '../../src/types.js';
import * as reporters from '../../src/reporters/index.js';
import * as importCmd from '../../src/cli/commands/import.js';
import Lockfile from '../../src/lockfile';
import * as fs from '../../src/util/fs.js';
import {run as buildRun} from './_helpers.js';

const YARN_VERSION_REGEX = /yarn v\S+/;
const YARN_VERSION = require('../../package.json').version;
const NODE_VERSION_REGEX = /node \S+/;
const NODE_VERSION = process.version;

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

const checkReporter = reporter => {
  expect(reporterErrors(reporter)).toEqual([]);
  expect(reporterType(reporter, 'info')).toEqual([]);
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

const checkReporterAndLockfile = async (config, reporter) => {
  checkReporter(reporter);
  await checkLockfile(config, reporter);
  checkReporter(reporter);
};

test.concurrent('import shallow deps', () => {
  return runImport([], {}, 'shallow', checkReporterAndLockfile);
});

test.concurrent('import deep deps', () => {
  return runImport([], {}, 'deep', checkReporterAndLockfile);
});

test.concurrent('import shallow dev deps', () => {
  return runImport([], {}, 'shallow-dev', checkReporterAndLockfile);
});

test.concurrent('import github deps', () => {
  return runImport([], {}, 'github', checkReporterAndLockfile);
});

test.concurrent('import file deps', () => {
  return runImport([], {}, 'file', checkReporterAndLockfile);
});

test.concurrent('throw on missing dev deps deps', async () => {
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

test.concurrent('throw on locked deps', async () => {
  let thrown = false;
  try {
    await runImport([], {}, 'locked');
  } catch (err) {
    thrown = true;
  }
  expect(thrown).toBeTruthy();
});
