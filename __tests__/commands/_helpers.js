/* @flow */

import Lockfile from '../../src/lockfile/wrapper.js';
import {ConsoleReporter} from '../../src/reporters/index.js';
import {Reporter} from '../../src/reporters/index.js';
import {parse} from '../../src/lockfile/wrapper.js';
import * as constants from '../../src/constants.js';
import {run as check} from '../../src/cli/commands/check.js';
import * as fs from '../../src/util/fs.js';
import {Install} from '../../src/cli/commands/install.js';
import Config from '../../src/config.js';

const stream = require('stream');
const path = require('path');
const os = require('os');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'install');

export const runInstall = run.bind(
  null,
  ConsoleReporter,
  fixturesLoc,
  async (args, flags, config, reporter, lockfile): Promise<Install> => {
    const install = new Install(flags, config, reporter, lockfile);
    await install.init();
    await check(config, reporter, {}, []);
    return install;
  },
  [],
);

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

export async function run<T, R>(
  Reporter: Class<Reporter & R>,
  fixturesLoc: string,
  factory: (
    args: Array<string>,
    flags: Object,
    config: Config,
    reporter: R,
    lockfile: Lockfile,
    getStdout: () => string,
  ) => Promise<T> | T,
  args: Array<string>,
  flags: Object,
  name: string,
  checkInstalled: ?(config: Config, reporter: R, install: T) => ?Promise<void>,
  beforeInstall: ?(cwd: string) => ?Promise<void>,
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

  const reporter = new Reporter({stdout, stderr: stdout});

  if (beforeInstall) {
    await beforeInstall(cwd);
  }

  // remove the lockfile if we create one and it didn't exist before
  const lockfile = await createLockfile(cwd);

  // create directories
  await fs.mkdirp(path.join(cwd, '.yarn-global'));
  await fs.mkdirp(path.join(cwd, '.yarn-link'));
  await fs.mkdirp(path.join(cwd, '.yarn-cache'));
  await fs.mkdirp(path.join(cwd, 'node_modules'));

  try {
    const config = new Config(reporter);
    await config.init({
      binLinks: !!flags.binLinks,
      cwd,
      globalFolder: path.join(cwd, '.yarn-global'),
      cacheFolder: path.join(cwd, '.yarn-cache'),
      linkFolder: path.join(cwd, '.yarn-link'),
    });

    const install = await factory(args, flags, config, reporter, lockfile, () => out);

    if (checkInstalled) {
      await checkInstalled(config, reporter, install);
    }
  } catch (err) {
    throw new Error(`${err && err.stack} \nConsole output:\n ${out}`);
  }
}
