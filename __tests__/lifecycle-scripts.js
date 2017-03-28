/* @flow */

import NoopReporter from '../src/reporters/base-reporter.js';
import makeTemp from './_temp';
import * as fs from '../src/util/fs.js';

const path = require('path');
const exec = require('child_process').exec;

const fixturesLoc = path.join(__dirname, './fixtures/lifecycle-scripts');
const yarnBin = path.join(__dirname, '../bin/yarn.js');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

async function execCommand(cmd: string, packageName: string, env = process.env): Promise<string> {
  const srcPackageDir = path.join(fixturesLoc, packageName);
  const packageDir = await makeTemp(packageName);

  await fs.copy(srcPackageDir, packageDir, new NoopReporter());

  return new Promise((resolve, reject) => {

    exec(`node "${yarnBin}" ${cmd}`, {cwd:packageDir, env}, (err, stdout) => {
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
  const env = Object.assign({}, process.env);
  delete env.npm_config_argv;

  let stdout = await execCommand('install', 'npm_config_argv_env_vars', env);
  expect(stdout).toContain('##install##');

  stdout = await execCommand('', 'npm_config_argv_env_vars', env);
  expect(stdout).toContain('##install##');

  stdout = await execCommand('test', 'npm_config_argv_env_vars', env);
  expect(stdout).toContain('##test##');
});

test('should only expose non-internal configs', async () => {
  const env = Object.assign({}, process.env);
  const internalConfigKeys = ['lastUpdateCheck'];
  const nonInternalConfigKeys = ['user_agent'];
  const prefix = 'npm_config_';
  [...internalConfigKeys, ...nonInternalConfigKeys].forEach((key) => {
    delete env[prefix + key];
  });

  let stdout = await execCommand('install', 'dont-expose-internal-configs-to-env', env);
  stdout = stdout.substring(
    stdout.indexOf('##') + 2,
    stdout.lastIndexOf('##'),
  );
  let configs = {};
  try {
    configs = JSON.parse(stdout);
  } catch (e) {}

  internalConfigKeys.forEach((key) => {
    const val = configs[prefix + key];
    expect(val).toBeUndefined();
  });

  nonInternalConfigKeys.forEach((key) => {
    const val = configs[prefix + key];
    expect(val).toBeDefined();
  });
});

test('should run both prepublish and prepare when installing, but not prepublishOnly', async () => {
  let stdout = await execCommand('install', 'lifecycle-scripts');

  expect(stdout).toMatch(/^running the prepublish hook$/m);
  expect(stdout).toMatch(/^running the prepare hook$/m);

  expect(stdout).not.toMatch(/^running the prepublishOnly hook$/m);
});
