/* @flow */

import {BufferReporter} from '../../src/reporters/index.js';
import {run as bin} from '../../src/cli/commands/bin.js';
import Config from '../../src/config.js';
import assert from 'assert';
import path from 'path';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 6000;

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'bin');

async function runBin(
  flags: Object,
  args: Array<string>,
  name: string,
  checkSteps?: ?(config: Config, reporter: BufferReporter) => ?Promise<void>,
): Promise<void> {
  const cwd = path.join(fixturesLoc, name);

  const reporter = new BufferReporter({stdout: null, stdin: null});

  try {
    const config = new Config(reporter);
    await config.init({cwd});

    await bin(config, reporter, flags, args);

    if (checkSteps) {
      await checkSteps(config, reporter);
    }

  } catch (err) {
    throw new Error(`${err && err.stack}`);
  }
}

test.concurrent('should output correct bin path when executed from package root', 
(): Promise<void> => {
  return runBin({}, [], '', (config, reporter) => {
    const expectedBinPath = path.join(fixturesLoc, 'node_modules', '.bin');
    const report = reporter.getBuffer();
    assert.equal(report[0].data, expectedBinPath);
  });
});
