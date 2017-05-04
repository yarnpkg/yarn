/* @flow */

/*
 * This test will me merge into one of the other files in this folder once this
 *  pull request approves.
 */

import {getPackageVersion, runInstall} from '../_helpers.js';
import * as fs from '../../../src/util/fs.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const path = require('path');

// helpers function to allow us to run more than one test on the same command
function getDeferred(): Object {
  const deferred = {};
  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = (...args) => resolve(args);
  });
  return deferred;
}

function runCommand(factory, flags, name): Object {
  const check = getDeferred();
  const before = getDeferred();
  factory(flags, name, check.resolve, before.resolve);
  return {toEnd: check.promise, before: before.promise};
}


// esay access to all tests
const instalTest = {};

async function readLogFile(config, name): Promise<Array<string>> {
  const resultPath = path.join(config.cwd, 'result.log');
  return (await fs.readFile(resultPath)).replace(/node_modules\//g, '').split('\n');
}

/*
  a1 > b1 > c1
  b2 > c1
  d1 > a1 > b1 > c1
     > b1 > c1

  We expect to have 4 hoisted packages: a1, b2, c1, d1, and 2 nested packages
  for b1: a1/b1 , d1/b1
*/
instalTest['nested dependencies with scripts'] = runCommand(runInstall, {}, 'nested-dependencies');

test.concurrent('install should run scripts', async () => {
  const [config] = await instalTest['nested dependencies with scripts'].toEnd;
  const resultPath = path.join(config.cwd, 'result.log');
  expect(await fs.exists(resultPath)).toBe(true);
});

test.concurrent('all dependency and subdependency should be installed', async () => {
  const [config] = await instalTest['nested dependencies with scripts'].toEnd;
  expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-a'))).toBe(true);
  expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-c'))).toBe(true);
  expect(await fs.exists(path.join(config.cwd, 'node_modules/dep-d'))).toBe(true);

  expect(await getPackageVersion(config, 'dep-b')).toBe('2.0.0');
  expect(await getPackageVersion(config, 'dep-a/dep-b')).toBe('1.0.0');
  expect(await getPackageVersion(config, 'dep-d/dep-b')).toBe('1.0.0');
});

test.concurrent('install should run all scripts from dependencies', async (): Promise<void> => {
  const [config] = await instalTest['nested dependencies with scripts'].toEnd;
  const result = await readLogFile(config);
  expect(result.indexOf('dep-a@1.0.0 built in: dep-a') > -1).toBe(true);
  expect(result.indexOf('dep-b@2.0.0 built in: dep-b') > -1).toBe(true);
  expect(result.indexOf('dep-c@1.0.0 built in: dep-c') > -1).toBe(true);
  expect(result.indexOf('dep-d@1.0.0 built in: dep-d') > -1).toBe(true);
  expect(result.indexOf('dep-b@1.0.0 built in: dep-d/dep-b') > -1).toBe(true);
});

test.concurrent('install should run scripts from nested dependencies', async (): Promise<void> => {
  const [config] = await instalTest['nested dependencies with scripts'].toEnd;
  const result = await readLogFile(config);
  expect(result.indexOf('dep-b@1.0.0 built in: dep-a/dep-b') > -1).toBe(true);
});
