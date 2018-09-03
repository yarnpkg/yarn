/* @flow */

import {existsSync} from 'fs';

import NoopReporter from '../src/reporters/base-reporter.js';
import makeTemp from './_temp';
import * as fs from '../src/util/fs.js';
const pkg = require('../package.json');

const path = require('path');
const exec = require('child_process').exec;

const fixturesLoc = path.join(__dirname, './fixtures/index');
const yarnBin = path.join(__dirname, '../bin/yarn.js');
const semver = require('semver');
let ver = process.versions.node;
ver = ver.split('-')[0];

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

if (!existsSync(path.resolve(__dirname, '../lib'))) {
  throw new Error('These tests require `yarn build` to have been run first.');
}

async function execCommand(
  cmd: string,
  args: Array<string>,
  name: string,
  makeTempDir: ?boolean,
): Promise<Array<?string>> {
  const srcDir = path.join(fixturesLoc, name);
  let workingDir = srcDir;
  if (makeTempDir) {
    workingDir = await makeTemp(name);
    await fs.copy(srcDir, workingDir, new NoopReporter());
  }

  const cacheDir = path.join(workingDir, '.yarn-cache');

  return new Promise((resolve, reject) => {
    const cleanedEnv = {...process.env};
    cleanedEnv['YARN_SILENT'] = 0;
    cleanedEnv['YARN_WRAP_OUTPUT'] = 1;
    delete cleanedEnv['FORCE_COLOR'];

    exec(
      `node "${yarnBin}" --cache-folder="${cacheDir}" ${cmd} ${args.join(' ')}`,
      {
        cwd: workingDir,
        env: cleanedEnv,
      },
      (error, stdout) => {
        if (error) {
          reject(Object.assign((new Error(error.message): any), {stdout}));
        } else {
          const stdoutLines = stdout
            .toString()
            .split('\n')
            .map((line: ?string) => line && line.trim())
            .filter((line: ?string) => line);

          resolve(stdoutLines);
        }
      },
    );
  });
}

function expectAddOutput(stdout) {
  expect(stdout.slice(1, stdout.length - 1)).toMatchSnapshot();
}

function expectRunOutput(stdout) {
  const lastLines = stdout.slice(stdout.length - 2);
  expect(lastLines[0]).toMatch(/A message from custom script/);
  expect(lastLines[1]).toMatch(/^Done/);
}

function expectHelpOutput(stdout) {
  expect(stdout[0]).toEqual('Usage: yarn [command] [flags]');
  const lastLines = stdout.slice(stdout.length - 2);
  expect(lastLines[0]).toEqual('Run `yarn help COMMAND` for more information on specific commands.');
  expect(lastLines[1]).toEqual('Visit https://yarnpkg.com/en/docs/cli/ to learn more about Yarn.');
}

function expectHelpOutputAsSubcommand(stdout) {
  expect(stdout[0]).toEqual('Usage: yarn add [packages ...] [flags]');
  expect(stdout[stdout.length - 1]).toEqual(
    'Visit https://yarnpkg.com/en/docs/cli/add for documentation about this command.',
  );
}

function expectAnErrorMessage(command: Promise<Array<?string>>, expectedMessage: string): Promise<void> {
  return command
    .then(function() {
      throw new Error('the command did not fail');
    })
    .catch(error => expect(error.message.replace(/\\/g, '')).toContain(expectedMessage));
}

function expectAnInfoMessageAfterError(command: Promise<Array<?string>>, expectedInfo: string): Promise<void> {
  return command
    .then(function() {
      throw new Error('the command did not fail');
    })
    .catch(error => expect(error.stdout).toContain(expectedInfo));
}

test('should add package', async () => {
  const stdout = await execCommand('add', ['left-pad@1.2.0'], 'run-add', true);
  expectAddOutput(stdout);
});

test('should add package with no-lockfile option', async () => {
  const stdout = await execCommand('add', ['repeating@3.0.0', '--no-lockfile'], 'run-add-option', true);
  expectAddOutput(stdout);
});

test('should add package with frozen-lockfile option', async () => {
  const stdout = await execCommand('add', ['repeating@3.0.0', '--frozen-lockfile'], 'run-add-option', true);
  expectAddOutput(stdout);
});

test('should add package with no-lockfile option in front', async () => {
  const stdout = await execCommand('add', ['--no-lockfile', 'split-lines@1.1.0'], 'run-add-option-in-front', true);
  expectAddOutput(stdout);
});

test('should add lockfile package', async () => {
  const stdout = await execCommand('add', ['lockfile@1.0.3'], 'run-add-lockfile', true);
  expectAddOutput(stdout);
});

// test is failing on Node 4, https://travis-ci.org/yarnpkg/yarn/jobs/216254539
if (semver.satisfies(ver, '>=5.0.0')) {
  test.concurrent('should add progress package globally', async () => {
    const stdout = await execCommand(
      'global',
      ['add', 'progress@2.0.0', '--global-folder', './global'],
      'run-add-progress-globally',
      true,
    );

    const lastLine = stdout[stdout.length - 1];
    expect(lastLine).toMatch(/^Done/);
  });
}

test.concurrent('should run custom script', async () => {
  const stdout = await execCommand('run', ['custom-script'], 'run-custom-script');
  expectRunOutput(stdout);
});

test.concurrent('should run custom script without run command', async () => {
  const stdout = await execCommand('custom-script', [], 'run-custom-script');
  expectRunOutput(stdout);
});

test.concurrent('should run help command', async () => {
  const stdout = await execCommand('help', [], 'run-help');
  expectHelpOutput(stdout);
});

test.concurrent('should run help command with --help', async () => {
  const stdout = await execCommand('--help', [], 'run-help');
  expectHelpOutput(stdout);
});

test.concurrent('should run help command with -h', async () => {
  const stdout = await execCommand('-h', [], 'run-help');
  expectHelpOutput(stdout);
});

test.concurrent('should run add command with help option', async () => {
  const stdout = await execCommand('add', ['--help'], 'run-help');
  expectHelpOutputAsSubcommand(stdout);
});

test.concurrent('should run add command with h option', async () => {
  const stdout = await execCommand('add', ['-h'], 'run-help');
  expectHelpOutputAsSubcommand(stdout);
});

test.concurrent('should run help command with add option', async () => {
  const stdout = await execCommand('help', ['add'], 'run-help');
  expectHelpOutputAsSubcommand(stdout);
});

test.concurrent('should run --help command with add option', async () => {
  const stdout = await execCommand('--help', ['add'], 'run-help');
  expectHelpOutputAsSubcommand(stdout);
});

test.concurrent('should run -h command with add option', async () => {
  const stdout = await execCommand('-h', ['add'], 'run-help');
  expectHelpOutputAsSubcommand(stdout);
});

test.concurrent('should show version of yarn with -v', async () => {
  const stdout = await execCommand('-v', [], 'run-version');
  expect(stdout[0]).toEqual(pkg.version);
});

test.concurrent('should run version command', async () => {
  const stdout = await execCommand('version', [], 'run-version');
  expect(stdout[0]).toEqual(`yarn version v${pkg.version}`);
});

test.concurrent('should run --version command', async () => {
  const stdout = await execCommand('--version', [], 'run-version');
  expect(stdout[0]).toEqual(pkg.version);
});

test.concurrent('should exit cleanly when running invalid commands', async () => {
  try {
    await execCommand('import', ['foobar'], 'run-version');
  } catch (err) {
    // not important - we really only want to check that the command terminates
  }
  try {
    await execCommand('remove', ['foobar'], 'run-version');
  } catch (err) {
    // not important - we really only want to check that the command terminates
  }
});

test.concurrent('should install if no args', async () => {
  const stdout = await execCommand('', [], 'run-add', true);
  expect(stdout[0]).toEqual(`yarn install v${pkg.version}`);
});

test.concurrent('should install if first arg looks like a flag', async () => {
  const stdout = await execCommand('--json', [], 'run-add', true);
  expect(stdout[stdout.length - 1]).toEqual('{"type":"success","data":"Saved lockfile."}');
});

test.concurrent('should not output JSON activity/progress if given --no-progress option', async () => {
  const activityInfo = ['activityStart', 'activityTick', 'activityEnd'];
  const progressInfo = ['progressStart', 'progressTick', 'progressFinish'];
  const stdout = await execCommand('', ['--json', '--no-progress'], 'run-add', true);
  stdout.forEach(line => {
    activityInfo.concat(progressInfo).forEach(info => {
      expect(line).not.toContain(info);
    });
  });
});

test.concurrent('should run help of run command if --help is before script', async () => {
  const stdout = await execCommand('run', ['--help', 'custom-script'], 'run-custom-script-with-arguments');
  expect(stdout[0]).toEqual('Usage: yarn [command] [flags]');
  expect(stdout[stdout.length - 1]).toEqual(
    'Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.',
  );
});

test.concurrent('should run help of custom-script if --help is after script', async () => {
  const stdout = await execCommand('run', ['--silent', 'custom-script', '--help'], 'run-custom-script-with-arguments');
  expect(JSON.parse(stdout.join('\n'))).toContain('--help');
});

test.concurrent('should run bin command', async () => {
  const stdout = await execCommand('bin', [], '', true);
  expect(stdout[0]).toMatch(/[\\\/]node_modules[\\\/]\.bin\n?$/);
  expect(stdout.length).toEqual(1);
});

test.concurrent('should throws missing command for not camelised command', async () => {
  await expectAnErrorMessage(execCommand('HelP', [], 'run-add', true), 'Command "HelP" not found');
});

test.concurrent('should throws missing command for not alphabetic command', async () => {
  await expectAnErrorMessage(execCommand('123', [], 'run-add', true), 'Command "123" not found');
});

test.concurrent('should throws missing command for unknown command', async () => {
  await expectAnErrorMessage(execCommand('unknown', [], 'run-add', true), 'Command "unknown" not found');
});

test.concurrent('should not display documentation link for unknown command', async () => {
  await expectAnInfoMessageAfterError(execCommand('unknown', [], 'run-add', true), '');
});

test.concurrent('should display documentation link for known command', async () => {
  await expectAnInfoMessageAfterError(
    execCommand('add', [], 'run-add', true),
    'Visit https://yarnpkg.com/en/docs/cli/add for documentation about this command.',
  );
});

test.concurrent('should throws missing command for constructor command', async () => {
  await expectAnErrorMessage(execCommand('constructor', [], 'run-add', true), 'Command "constructor" not found');
});

test.concurrent('should run command with hyphens', async () => {
  const stdout = await execCommand('generate-lock-entry', [], 'run-generate-lock-entry');
  expect(stdout[0]).toMatch(/# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY./);
  expect(stdout[1]).toMatch(/# yarn lockfile v1/);
});

test.concurrent('should run camelised command for command with hyphens', async () => {
  const stdout = await execCommand('generateLockEntry', [], 'run-generate-lock-entry');
  expect(stdout[0]).toMatch(/# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY./);
  expect(stdout[1]).toMatch(/# yarn lockfile v1/);
});

test.concurrent('should run help for command with hyphens', async () => {
  const stdout = await execCommand('generate-lock-entry', ['--help'], 'run-generate-lock-entry');
  const lastLines = stdout.slice(stdout.length - 4);
  expect(lastLines[0]).toMatch(/yarn generate-lock-entry/);
  expect(lastLines[1]).toMatch(/yarn generate-lock-entry --use-manifest .\/package.json/);
  expect(lastLines[2]).toMatch(/yarn generate-lock-entry --resolved local-file.tgz#hash/);
  expect(lastLines[3]).toMatch(/Visit https:\/\/yarnpkg.com\/en\/docs\/cli\/generate-lock-entry/);
});

test.concurrent('should run help for camelised command', async () => {
  const stdout = await execCommand('generateLockEntry', ['--help'], 'run-generate-lock-entry');
  const lastLines = stdout.slice(stdout.length - 4);
  expect(lastLines[0]).toMatch(/yarn generate-lock-entry/);
  expect(lastLines[1]).toMatch(/yarn generate-lock-entry --use-manifest .\/package.json/);
  expect(lastLines[2]).toMatch(/yarn generate-lock-entry --resolved local-file.tgz#hash/);
  expect(lastLines[3]).toMatch(/Visit https:\/\/yarnpkg.com\/en\/docs\/cli\/generate-lock-entry/);
});

// regression test for #5496
// this fixture has a .yarnrc in it that sets the `--emoji` flag.
// we test to make sure that flag is not passed down to the workspace command,
// but actual flags on the command line are passed.
test.concurrent('should not pass yarnrc flags to workspace command', async () => {
  const stdout = await execCommand('workspace', ['workspace-1', 'run', 'check', '--x'], 'run-workspace', true);
  const params = stdout.find(x => x && x.indexOf('--x') >= 0);
  expect(params).not.toMatch(/emoji/);
});
