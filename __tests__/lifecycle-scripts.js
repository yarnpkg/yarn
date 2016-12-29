/* @flow */

import NoopReporter from '../src/reporters/base-reporter.js';
import makeTemp from './_temp';
import * as fs from '../src/util/fs.js';

const path = require('path');
const exec = require('child_process').exec;

const fixturesLoc = path.join(__dirname, './fixtures/lifecycle-scripts');
const yarnBin = path.join(__dirname, '../bin/yarn.js');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

async function execCommand(cmd: string, packageName: string): Promise<string> {
  const srcPackageDir = path.join(fixturesLoc, packageName);
  const packageDir = await makeTemp(packageName);

  await fs.copy(srcPackageDir, packageDir, new NoopReporter());

  return new Promise((resolve, reject) => {
    const env = Object.assign({}, process.env);

    delete env.npm_config_argv;

    exec(`node ${yarnBin} ${cmd}`, {cwd:packageDir, env}, (err, stdout) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout.toString());
      }
    });
  });
}

test('should expose `npm_config_argv` environment variable to lifecycle scripts for back compatibility with npm (#684)',
async () => {
  let stdout = await execCommand('install', 'npm_config_argv_env_vars');
  expect(stdout).toContain('##install##');

  stdout = await execCommand('', 'npm_config_argv_env_vars');
  expect(stdout).toContain('##install##');

  stdout = await execCommand('test', 'npm_config_argv_env_vars');
  expect(stdout).toContain('##test##');
});
