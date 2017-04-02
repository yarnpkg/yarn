/* @flow */

import {run as buildRun, runInstall} from './_helpers.js';
import * as checkCmd from '../../src/cli/commands/check.js';
import * as reporters from '../../src/reporters/index.js';
import type {CLIFunctionReturn} from '../../src/types.js';
import * as fs from '../../src/util/fs.js';


const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'check');

const runCheck = buildRun.bind(
  null,
  reporters.ConsoleReporter,
  fixturesLoc,
  (args, flags, config, reporter): CLIFunctionReturn => {
    return checkCmd.run(config, reporter, flags, args);
  },
);

test.concurrent('--verify-tree should report wrong version ', async (): Promise<void> => {
  let thrown = false;
  try {
    await runCheck([], {verifyTree: true}, 'verify-tree-version-mismatch');
  } catch (e) {
    thrown = true;
  }
  expect(thrown).toEqual(true);
});

test.concurrent('--verify-tree should report missing dependency ', async (): Promise<void> => {
  let thrown = false;
  try {
    await runCheck([], {verifyTree: true}, 'verify-tree-not-found');
  } catch (e) {
    thrown = true;
  }
  expect(thrown).toEqual(true);
});

test.concurrent('--verify-tree should pass on hoisted dependency ', async (): Promise<void> => {
  await runCheck([], {verifyTree: true}, 'verify-tree-hoisted');
});

test.concurrent('--verify-tree should check dev dependencies ', async (): Promise<void> => {
  let thrown = false;
  try {
    await runCheck([], {verifyTree: true}, 'verify-tree-dev');
  } catch (e) {
    thrown = true;
  }
  expect(thrown).toEqual(true);
});

test.concurrent('--verify-tree should check skip dev dependencies if --production flag passed',
async (): Promise<void> => {
  await runCheck([], {verifyTree: true, production: true}, 'verify-tree-dev-prod');
});

test.concurrent('--verify-tree should check skip deeper dev dependencies', async (): Promise<void> => {
  await runCheck([], {verifyTree: true, production: true}, 'verify-tree-dev-deep');
});

test.concurrent('--integrity should ignore comments and whitespaces in yarn.lock', async (): Promise<void> => {
  await runInstall({}, path.join('..', 'check', 'integrity-lock-check'), async (config, reporter): Promise<void> => {
    let lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    lockfile += '\n# ADDING THIS COMMENTN WON\'T AFFECT INTEGRITY CHECK \n';
    await fs.writeFile(path.join(config.cwd, 'yarn.lock'), lockfile);

    let thrown = false;
    try {
      await checkCmd.run(config, reporter, {integrity: true}, []);
    } catch (e) {
      thrown = true;
    }
    expect(thrown).toEqual(false);
  });
});

test.concurrent('--integrity should fail if yarn.lock has patterns changed', async (): Promise<void> => {
  await runInstall({}, path.join('..', 'check', 'integrity-lock-check'), async (config, reporter): Promise<void> => {
    let lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    lockfile = lockfile.replace('left-pad@1.1.1', 'left-pad@1.1.0');
    await fs.writeFile(path.join(config.cwd, 'yarn.lock'), lockfile);

    let thrown = false;
    try {
      await checkCmd.run(config, reporter, {integrity: true}, []);
    } catch (e) {
      thrown = true;
    }
    expect(thrown).toEqual(true);
  });
});

test.concurrent('--integrity should fail if yarn.lock has new pattern', async (): Promise<void> => {
  await runInstall({}, path.join('..', 'check', 'integrity-lock-check'), async (config, reporter): Promise<void> => {
    let lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    lockfile += `\nxtend@^4.0.0:
  version "4.0.1"
  resolved "https://registry.yarnpkg.com/xtend/-/xtend-4.0.1.tgz#a5c6d532be656e23db820efb943a1f04998d63af"`;
    await fs.writeFile(path.join(config.cwd, 'yarn.lock'), lockfile);

    let thrown = false;
    try {
      await checkCmd.run(config, reporter, {integrity: true}, []);
    } catch (e) {
      thrown = true;
    }
    expect(thrown).toEqual(true);
  });
});

test.concurrent('--integrity should fail if yarn.lock has resolved changed', async (): Promise<void> => {
  await runInstall({}, path.join('..', 'check', 'integrity-lock-check'), async (config, reporter): Promise<void> => {
    let lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    lockfile = lockfile.replace('https://registry.npmjs.org/left-pad/-/left-pad-1.1.1.tgz',
      'https://registry.yarnpkg.com/left-pad/-/left-pad-1.1.1.tgz');
    await fs.writeFile(path.join(config.cwd, 'yarn.lock'), lockfile);

    let thrown = false;
    try {
      await checkCmd.run(config, reporter, {integrity: true}, []);
    } catch (e) {
      thrown = true;
    }
    expect(thrown).toEqual(true);
  });
});

test.concurrent('--integrity should fail if files are missing and --check-files is passed',
async (): Promise<void> => {
  await runInstall({checkFiles: true}, path.join('..', 'check', 'integrity-lock-check'),
  async (config, reporter): Promise<void> => {
    await fs.unlink(path.join(config.cwd, 'node_modules', 'left-pad', 'index.js'));

    let thrown = false;
    try {
      await checkCmd.run(config, reporter, {integrity: true, checkFiles: true}, []);
    } catch (e) {
      thrown = true;
    }
    expect(thrown).toEqual(true);
  });
});

// TODO add tests for switching install -> install --check-files
// TODO install --check-files -> check --integrity should imply --check-files?
// TODO add test for when resolver merges a few repeating manifests and lockfile gets rewritten: install.js:610

