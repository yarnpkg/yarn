/* @flow */

import {Reporter} from '../../src/reporters/index.js';
import * as reporters from '../../src/reporters/index.js';
import * as fs from '../../src/util/fs.js';
import {run as init} from '../../src/cli/commands/init.js';
import Config from '../../src/config.js';

const stream = require('stream');
const path = require('path');
const os = require('os');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'init');

export function runInit(
  flags: Object,
  name: string,
  checkInitialized?: ?(config: Config) => ?Promise<void>,
): Promise<void> {
  return run(() => {
    return init;
  }, flags, path.join(fixturesLoc, name), checkInitialized);
}

export async function run(
  factory: () => (config: Config, reporter: Reporter, flags: Object, args: Array<string>) => Promise<void>,
  flags: Object,
  dir: string,
  checkInitialized: ?(config: Config) => ?Promise<void>,
): Promise<void> {
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

  const reporter = new reporters.ConsoleReporter({stdout, stderr: stdout});

  // create directories
  await fs.mkdirp(path.join(cwd, '.yarn'));
  await fs.mkdirp(path.join(cwd, 'node_modules'));

  try {
    const config = new Config(reporter);
    await config.init({
      cwd,
      globalFolder: path.join(cwd, '.yarn/.global'),
      packagesRoot: path.join(cwd, '.yarn'),
      linkFolder: path.join(cwd, '.yarn/.link'),
    });

    await init(config, reporter, flags, []);

    try {
      if (checkInitialized) {
        await checkInitialized(config);
      }
    } finally {
      // clean up
      await fs.unlink(cwd);
    }
  } catch (err) {
    throw new Error(`${err && err.stack} \nConsole output:\n ${out}`);
  }
}
