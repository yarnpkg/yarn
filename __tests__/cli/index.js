/* @flow */
const path = require('path');
const exec = require('child_process').exec;
import * as fs from '../../src/util/fs.js';
import makeTemp from '../_temp.js';
import NoopReporter from '../../src/reporters/base-reporter.js';
import * as constants from '../../src/constants.js';
import assert from 'assert';

const yarnBin = path.join(__dirname, '..', '..', 'bin', 'yarn.js');
const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'index');

async function setupWorkingDir(fixture: string): Promise<string> {
  const srcDir = path.join(fixturesLoc, fixture);
  const workingDir = await makeTemp(fixture);
  await fs.copy(srcDir, workingDir, new NoopReporter());

  return workingDir;
}

function execCommand(workingDir: string, cacheDir: string): Promise<string> {
  const relativeBin = path.relative(workingDir, yarnBin);

  return new Promise((resolve, reject) => {
    exec(`node "${relativeBin}" tag rm non-existing-pkg non-existing-tag --cache-folder ${cacheDir} | cat`,
    {cwd: workingDir}, (err, stdout) => {
      if (err) {
        reject(err);
      } else {
        resolve(workingDir);
      }
    });
  });
}

test('Verify path errorReport log', async () => {
  const workingDir = await setupWorkingDir('run-failing-custom-script');
  const cacheDir = path.join(workingDir, 'cache');
  await fs.mkdirp(cacheDir);

  await execCommand(workingDir, cacheDir);
  assert.ok(await fs.exists(path.join(cacheDir, 'v' + String(constants.CACHE_VERSION), 'yarn-error.log')));
});
