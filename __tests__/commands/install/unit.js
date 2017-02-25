/* @flow */

import {NoopReporter} from '../../../src/reporters/index.js';
import {Install} from '../../../src/cli/commands/install.js';
import Lockfile from '../../../src/lockfile/wrapper.js';
import Config from '../../../src/config.js';

const assert = require('assert');
const path = require('path');

const fixturesLoc = path.join(__dirname, '..', '..', 'fixtures', 'install');

test.concurrent('integrity hash respects flat and production flags', async () => {
  const cwd = path.join(fixturesLoc, 'noop');
  const reporter = new NoopReporter();
  const config = await Config.create({cwd}, reporter);

  const lockfile = new Lockfile();

  const install = new Install({}, config, reporter, lockfile);

  const install2 = new Install({flat: true}, config, reporter, lockfile);
  expect(install2.generateIntegrityHash('foo', [])).not.toEqual(install.generateIntegrityHash('foo', []));

  const config2 = await Config.create({cwd, production: true}, reporter);
  const install3 = new Install({}, config2, reporter, lockfile);
  expect(install3.generateIntegrityHash('foo', [])).not.toEqual(install.generateIntegrityHash('foo', []));
  expect(install3.generateIntegrityHash('foo', [])).not.toEqual(install2.generateIntegrityHash('foo', []));
});

test.concurrent('flat arg is inherited from root manifest', async (): Promise<void> => {
  const cwd = path.join(fixturesLoc, 'top-level-flat-parameter');
  const reporter = new NoopReporter();
  const config = await Config.create({cwd});
  const install = new Install({}, config, reporter, new Lockfile());
  return install.fetchRequestFromCwd().then(function({manifest}) {
    assert.equal(manifest.flat, true);
    assert.equal(install.flags.flat, true);
  });
});
