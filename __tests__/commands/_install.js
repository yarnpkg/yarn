/* @flow */

import Lockfile from '../../src/lockfile/wrapper.js';
import {Reporter} from '../../src/reporters/index.js';
import {parse} from '../../src/lockfile/wrapper.js';
import * as reporters from '../../src/reporters/index.js';
import * as constants from '../../src/constants.js';
import {run as check} from '../../src/cli/commands/check.js';
import * as fs from '../../src/util/fs.js';
import {Install} from '../../src/cli/commands/install.js';
import Config from '../../src/config.js';

const stream = require('stream');
const path = require('path');
const os = require('os');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'install');

export function runInstall(
  flags: Object,
  name: string,
  checkInstalled?: ?(config: Config, reporter: Reporter, install: Install) => ?Promise<void>,
  beforeInstall?: ?(cwd: string) => ?Promise<void>,
): Promise<void> {
  return run((config, reporter, lockfile): Install => {
    return new Install(flags, config, reporter, lockfile);
  }, path.join(fixturesLoc, name), checkInstalled, beforeInstall);
}

export async function createLockfile(dir: string): Promise<Lockfile> {
  const lockfileLoc = path.join(dir, constants.LOCKFILE_FILENAME);
  let lockfile;

  if (await fs.exists(lockfileLoc)) {
    const rawLockfile = await fs.readFile(lockfileLoc);
    lockfile = parse(rawLockfile);
  }

  return new Lockfile(lockfile);
}

export function explodeLockfile(lockfile: string): Array<string> {
  return lockfile.split('\n').filter((line): boolean => !!line && line[0] !== '#');
}

export async function getPackageVersion(config: Config, packagePath: string): Promise<string> {
  const loc = path.join(config.cwd, `node_modules/${packagePath.replace(/\//g, '/node_modules/')}/package.json`);
  const json = JSON.parse(await fs.readFile(loc));
  return json.version;
}

export async function run(
  factory: (config: Config, reporter: Reporter, lockfile: Lockfile) => Install,
  dir: string,
  checkInstalled: ?(config: Config, reporter: Reporter, install: Install) => ?Promise<void>,
  beforeInstall: ?(cwd: string) => ?Promise<void>,
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

  if (beforeInstall) {
    await beforeInstall(cwd);
  }

  // remove the lockfile if we create one and it didn't exist before
  const lockfile = await createLockfile(cwd);

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

    const install = factory(config, reporter, lockfile);
    await install.init();

    // self check to verify consistency after installation
    await check(config, reporter, {}, []);
    try {
      if (checkInstalled) {
        await checkInstalled(config, reporter, install);
      }
    } finally {
      // clean up
      await fs.unlink(cwd);
    }
  } catch (err) {
    throw new Error(`${err && err.stack} \nConsole output:\n ${out}`);
  }
}
