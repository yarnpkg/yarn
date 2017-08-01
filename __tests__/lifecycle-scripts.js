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
    exec(
      `node "${yarnBin}" ${cmd}`,
      {
        cwd: packageDir,
        env: {
          ...env,
          YARN_SILENT: 0,
        },
      },
      (err, stdout) => {
        if (err) {
          reject(err);
        } else {
          resolve(stdout.toString());
        }
      },
    );
  });
}

test('should add the global yarnrc arguments to the command line', async () => {
  const stdout = await execCommand('cache dir', 'yarnrc-cli');
  expect(stdout.replace(/\\/g, '/')).toMatch(/^(C:)?\/tmp\/foobar\/v[0-9]+\n$/);
});

test('should add the command-specific yarnrc arguments to the command line if the command name matches', async () => {
  const stdout = await execCommand('cache dir', 'yarnrc-cli-command-specific-ok');
  expect(stdout.replace(/\\/g, '/')).toMatch(/^(C:)?\/tmp\/foobar\/v[0-9]+\n$/);
});

test("should not add the command-specific yarnrc arguments if the command name doesn't match", async () => {
  const stdout = await execCommand('cache dir', 'yarnrc-cli-command-specific-ko');
  expect(stdout.replace(/\\/g, '/')).not.toMatch(/^(C:)?\/tmp\/foobar\/v[0-9]+\n$/);
});

test('should allow overriding the yarnrc values from the command line', async () => {
  const stdout = await execCommand('cache dir --cache-folder /tmp/toto', 'yarnrc-cli');
  expect(stdout.replace(/\\/g, '/')).toMatch(/^(C:)?\/tmp\/toto\/v[0-9]+\n$/);
});

// Test disabled for now, cf rc.js
test('should resolve the yarnrc values relative to where the file lives', async () => {
  const stdout = await execCommand('cache dir', 'yarnrc-cli-relative');
  expect(stdout.replace(/\\/g, '/')).toMatch(/^(C:)?(\/[^\/]+)+\/foobar\/hello\/world\/v[0-9]+\n$/);
});

test('should expose `npm_config_argv` env variable to lifecycle scripts for back compatibility with npm', async () => {
  const env = Object.assign({}, process.env);
  delete env.npm_config_argv;

  let stdout = await execCommand('install', 'npm_config_argv_env_vars', env);
  expect(stdout).toContain('##install##');

  stdout = await execCommand('', 'npm_config_argv_env_vars', env);
  expect(stdout).toContain('##install##');

  stdout = await execCommand('run test', 'npm_config_argv_env_vars', env);
  expect(stdout).toContain('##test##');

  stdout = await execCommand('test', 'npm_config_argv_env_vars', env);
  expect(stdout).toContain('##test##');
});

test('should not run pre/post hooks for .bin executables', async () => {
  await execCommand('install', 'script_only_pre_post');
  const stdout = await execCommand('run lol', 'script_only_pre_post');
  expect(stdout).toContain('lol');
  expect(stdout).not.toContain('##prelol##');
  expect(stdout).not.toContain('##postlol##');
});

test('should not run pre/post hooks if they are .bin executables and not scripts', async () => {
  await execCommand('install', 'script_only_pre_post');
  const stdout = await execCommand('run lol', 'bin_pre_post');
  expect(stdout).toContain('lol');
  expect(stdout).not.toContain('##prelol##');
});

test('should only expose non-internal configs', async () => {
  const env = Object.assign({}, process.env);
  const internalConfigKeys = ['lastUpdateCheck'];
  const nonInternalConfigKeys = ['user_agent'];
  const prefix = 'npm_config_';
  [...internalConfigKeys, ...nonInternalConfigKeys].forEach(key => {
    delete env[prefix + key];
  });

  let stdout = await execCommand('install', 'dont-expose-internal-configs-to-env', env);
  stdout = stdout.substring(stdout.indexOf('##') + 2, stdout.lastIndexOf('##'));
  let configs = {};
  try {
    configs = JSON.parse(stdout);
  } catch (e) {}

  internalConfigKeys.forEach(key => {
    const val = configs[prefix + key];
    expect(val).toBeUndefined();
  });

  nonInternalConfigKeys.forEach(key => {
    const val = configs[prefix + key];
    expect(val).toBeDefined();
  });
});

test('should run both prepublish and prepare when installing, but not prepublishOnly', async () => {
  const stdout = await execCommand('install', 'lifecycle-scripts');

  expect(stdout).toMatch(/^running the prepublish hook$/m);
  expect(stdout).toMatch(/^running the prepare hook$/m);

  expect(stdout).not.toMatch(/^running the prepublishOnly hook$/m);
});

test('should allow setting environment variables via yarnrc', async () => {
  const stdout = await execCommand('install', 'yarnrc-env');
  expect(stdout).toMatch(/^BAR$/m);
});

test('should inherit existing environment variables when setting via yarnrc', async () => {
  const srcPackageDir = path.join(fixturesLoc, 'yarnrc-env');
  const packageDir = await makeTemp('yarnrc-env-nested');

  await fs.copy(srcPackageDir, packageDir, new NoopReporter());

  const stdout = await new Promise((resolve, reject) => {
    exec(`node "${yarnBin}" install`, {cwd: path.join(packageDir, 'nested')}, (err, stdout) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout.toString());
      }
    });
  });

  expect(stdout).toMatch(/^RAB$/m);
  expect(stdout).toMatch(/^FOO$/m);
});
