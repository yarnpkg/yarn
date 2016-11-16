/* @flow */

import {Reporter} from '../../src/reporters/index.js';
import {run as global} from '../../src/cli/commands/global.js';
import * as fs from '../../src/util/fs.js';
import * as reporters from '../../src/reporters/index.js';
import Config from '../../src/config.js';
import assert from 'assert';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const stream = require('stream');
const path = require('path');
const os = require('os');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'global');

async function runGlobal(
  command: string,
  flags: Object,
  args: Array<string>,
  name: string,
  checkGlobal?: ?(config: Config, reporter: Reporter, out: string) => ?Promise<void>,
): Promise<void> {
  const dir = path.join(fixturesLoc, name);
  const cwd = path.join(
    os.tmpdir(),
    `yarn-${path.basename(dir)}-${Math.random()}`,
  );
  await fs.unlink(cwd);
  await fs.copy(dir, cwd);

  for (const {basename, absolute} of await fs.walk(cwd)) {
    if (basename.toLowerCase() === '.ds_store') {
      await fs.unlink(absolute);
    }
  }

  let out = '';
  const stdout = new stream.Writable({
    decodeStrings: false,
    write(data, encoding, cb) {
      out += data;
      cb();
    },
  });

  const reporter = new reporters.JSONReporter({stdout});

  // create directories
  await fs.mkdirp(path.join(cwd, '.yarn'));
  await fs.mkdirp(path.join(cwd, 'node_modules'));

  try {
    const config = new Config(reporter);
    await config.init({
      cwd,
      globalFolder: path.join(cwd, '.yarn/.global'),
      cacheFolder: path.join(cwd, '.yarn'),
      linkFolder: path.join(cwd, '.yarn/.link'),
    });

    await global(config, reporter, flags, [command, ...args]);

    if (checkGlobal) {
      await checkGlobal(config, reporter, out);
    }

  } catch (err) {
    throw new Error(`${err && err.stack} \nConsole output:\n ${out}`);
  }
}
test.concurrent('add without flag', (): Promise<void> => {
  return runGlobal('add', {}, ['react-native-cli'], 'add-without-flag', async (config) => {
    assert.ok(await fs.exists(path.join(config.cwd, 'node_modules', 'react-native-cli')));
  });
});
