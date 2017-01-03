/* @flow */

import NoopReporter from '../../src/reporters/base-reporter.js';
import makeTemp from '../_temp';
import * as fs from '../../src/util/fs.js';

const path = require('path');
const exec = require('child_process').exec;

const fixturesLoc = path.join(__dirname, '../fixtures/cli');
const yarnBin = path.join(__dirname, '../../bin/yarn.js');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

async function execCommand(cmd: string, packageName: string): Promise<string> {
  const srcPackageDir = path.join(fixturesLoc, packageName);
  const packageDir = await makeTemp(packageName);

  await fs.copy(srcPackageDir, packageDir, new NoopReporter());

  return new Promise((resolve, reject) => {
    exec(`node ${yarnBin} ${cmd}`, {cwd:packageDir}, (err, stdout) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout.toString());
      }
    });
  });
}

test('should add `assert` package', async () => {
  const stdout = await execCommand('add assert', 'add');
  expect(stdout).toContain('success');
  expect(stdout).toContain('assert');
});

describe('should add packages that share a name with a CLI option', () => {
  const packages = [
    'json',
    'force',
    'flat',
    'prod',
    'production',
    'mutex',
    'proxy',
    'https-proxy',
    'dev',
    'peer',
    'optional',
    'exact',
    'tilde',
  ];

  packages.forEach((pkg) => {
    test(`should add '${pkg}' package`, async () => {
      const stdout = await execCommand(`add ${pkg}`, 'add');
      expect(stdout).toContain('success');
      expect(stdout).toContain(pkg);
    });
  });

  packages.forEach((pkg) => {
    test(`should add --dev '${pkg}' package`, async () => {
      const stdout = await execCommand(`add --dev ${pkg}`, 'add');
      expect(stdout).toContain('success');
      expect(stdout).toContain(pkg);
    });
  });

  packages.forEach((pkg) => {
    test(`should add assert and '${pkg}' packages`, async () => {
      const stdout = await execCommand(`add ${pkg} assert`, 'add');
      expect(stdout).toContain('success');
      expect(stdout).toContain('assert');
      expect(stdout).toContain(pkg);
    });
  });
});
