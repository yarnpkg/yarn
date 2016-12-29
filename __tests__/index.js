/* @flow */

import NoopReporter from '../src/reporters/base-reporter.js';
import makeTemp from './_temp';
import * as fs from '../src/util/fs.js';

const path = require('path');
const exec = require('child_process').exec;

const fixturesLoc = path.join(__dirname, './fixtures/index');
const yarnBin = path.join(__dirname, '../bin/yarn.js');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

async function execCommand(cmd: string, args: Array<string>, name: string, makeTempDir: ?boolean):
Promise<Array<?string>> {
  const srcDir = path.join(fixturesLoc, name);
  let workingDir = srcDir;
  if (makeTempDir) {
    workingDir = await makeTemp(name);
    await fs.copy(srcDir, workingDir, new NoopReporter());
  }

  return new Promise((resolve, reject) => {
    exec(`node ${yarnBin} ${cmd} ${args.join(' ')}`, {cwd:workingDir, env:process.env}, (err, stdout) => {
      if (err) {
        reject(err);
      } else {
        const stdoutLines = stdout.toString()
          .split('\n')
          .map((line: ?string) => line && line.trim())
          .filter((line: ?string) => line);

        resolve(stdoutLines);
      }
    });
  });
}

test.concurrent('should add package', async () => {
  const stdout = await execCommand('add', ['left-pad'], 'run-add', true);
  const lastLines = stdout.slice(stdout.length - 4);
  expect(lastLines[0]).toEqual('success Saved lockfile.');
  expect(lastLines[1]).toEqual('success Saved 1 new dependency.');
  expect(lastLines[2]).toMatch(/left-pad/);
  expect(lastLines[3]).toMatch(/^Done/);
});

test.concurrent('should add package with no-lockfile option', async () => {
  const stdout = await execCommand('add', ['repeating', '--no-lockfile'], 'run-add-option', true);
  const lastLines = stdout.slice(stdout.length - 4);
  expect(lastLines[0]).not.toMatch(/Saved lockfile/);
  expect(lastLines[1]).toEqual('success Saved 1 new dependency.');
  expect(lastLines[2]).toMatch(/repeating/);
  expect(lastLines[3]).toMatch(/^Done/);
});

test.concurrent('should add package with no-lockfile option in front', async () => {
  const stdout = await execCommand('add', ['--no-lockfile', 'split-lines'], 'run-add-option-in-front', true);
  const lastLines = stdout.slice(stdout.length - 4);
  expect(lastLines[0]).not.toMatch(/Saved lockfile/);
  expect(lastLines[1]).toEqual('success Saved 1 new dependency.');
  expect(lastLines[2]).toMatch(/split-lines/);
  expect(lastLines[3]).toMatch(/^Done/);
});

test.concurrent('should add lockfile package', async () => {
  const stdout = await execCommand('add', ['lockfile'], 'run-add-lockfile', true);
  const lastLines = stdout.slice(stdout.length - 4);
  expect(lastLines[0]).toEqual('success Saved lockfile.');
  expect(lastLines[1]).toEqual('success Saved 1 new dependency.');
  expect(lastLines[2]).toMatch(/lockfile/);
  expect(lastLines[3]).toMatch(/^Done/);
});

test.concurrent('should add progress package globally', async () => {
  const stdout = await execCommand('global',
    ['add', 'progress', '--global-folder', './global'],
    'run-add-progress-globally',
    true);

  const lastLine = stdout[stdout.length - 1];
  expect(lastLine).toMatch(/^Done/);
});

test.concurrent('should run custom script', async () => {
  const stdout = await execCommand('run', ['custom-script'], 'run-custom-script');
  const lastLines = stdout.slice(stdout.length - 2);
  expect(lastLines[0]).toMatch(/A message from custom script/);
  expect(lastLines[1]).toMatch(/^Done/);
});

test.concurrent('should run custom script without run command', async () => {
  const stdout = await execCommand('custom-script', [], 'run-custom-script');
  const lastLines = stdout.slice(stdout.length - 2);
  expect(lastLines[0]).toMatch(/A message from custom script/);
  expect(lastLines[1]).toMatch(/^Done/);
});

test.concurrent('should run help command', async () => {
  const stdout = await execCommand('help', [], 'run-help');
  expect(stdout[0]).toEqual('Usage: yarn [command] [flags]');
});

test.concurrent('should run add command with help option', async () => {
  const stdout = await execCommand('add', ['--help'], 'run-help');
  expect(stdout[0]).toEqual('Usage: yarn add [packages ...] [flags]');
});
