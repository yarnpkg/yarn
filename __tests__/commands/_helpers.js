/* @flow */

import Lockfile from '../../src/lockfile';
import {ConsoleReporter} from '../../src/reporters/index.js';
import {Reporter} from '../../src/reporters/index.js';
import {parse} from '../../src/lockfile';
import * as constants from '../../src/constants.js';
import {run as check} from '../../src/cli/commands/check.js';
import * as fs from '../../src/util/fs.js';
import {Install} from '../../src/cli/commands/install.js';
import Config from '../../src/config.js';
import parsePackagePath from '../../src/util/parse-package-path.js';
import type {CLIFunctionReturn} from '../../src/types.js';
import {run as link} from '../../src/cli/commands/link.js';
const stream = require('stream');
const path = require('path');

const installFixturesLoc = path.join(__dirname, '..', 'fixtures', 'install');

// $FlowFixMe I don't understand the error
export const runInstall = run.bind(
  null,
  ConsoleReporter,
  installFixturesLoc,
  async (args, flags, config, reporter, lockfile): Promise<Install> => {
    const install = new Install(flags, config, reporter, lockfile);
    await install.init();
    await check(config, reporter, {}, []);
    await check(config, reporter, {verifyTree: true}, []);
    return install;
  },
  [],
);

const linkFixturesLoc = path.join(__dirname, '..', 'fixtures', 'link');

// $FlowFixMe I don't understand the error
export const runLink = run.bind(
  null,
  ConsoleReporter,
  linkFixturesLoc,
  (args, flags, config, reporter): CLIFunctionReturn => {
    return link(config, reporter, flags, args);
  },
);

export async function createLockfile(dir: string): Promise<Lockfile> {
  const lockfileLoc = path.join(dir, constants.LOCKFILE_FILENAME);
  let lockfile;

  if (await fs.exists(lockfileLoc)) {
    const rawLockfile = await fs.readFile(lockfileLoc);
    lockfile = parse(rawLockfile).object;
  }

  return new Lockfile({cache: lockfile, parseResultType: 'success'});
}

export function explodeLockfile(lockfile: string): Array<string> {
  return lockfile.split('\n').filter((line): boolean => !!line && line[0] !== '#');
}

export async function getPackageVersion(config: Config, packagePath: string): Promise<string> {
  return (await getPackageManifest(config, packagePath)).version;
}

export function getPackageManifest(config: Config, packagePath: string): Promise<any> {
  return fs.readJson(getPackageManifestPath(config, packagePath));
}

export function getPackageManifestPath(config: Config, packagePath: string): string {
  return path.join(getPackagePath(config, packagePath), 'package.json');
}

export function isPackagePresent(config: Config, packagePath: string): Promise<boolean> {
  return fs.exists(getPackagePath(config, packagePath));
}

export function getPackagePath(config: Config, packagePath: string): string {
  return path.join(config.cwd, `node_modules/${parsePackagePath(packagePath).join('/node_modules/')}`);
}

export function makeConfigFromDirectory(cwd: string, reporter: Reporter, flags: Object = {}): Promise<Config> {
  return Config.create(
    {
      binLinks: !!flags.binLinks,
      cwd,
      globalFolder: flags.globalFolder || path.join(cwd, '.yarn-global'),
      cacheFolder: flags.cacheFolder || path.join(cwd, '.yarn-cache'),
      linkFolder: flags.linkFolder || path.join(cwd, '.yarn-link'),
      prefix: flags.prefix,
      production: flags.production,
      updateChecksums: !!flags.updateChecksums,
      offline: !!flags.offline,
      nonInteractive: typeof flags.nonInteractive !== 'undefined' ? Boolean(flags.nonInteractive) : true,
      focus: !!flags.focus,
      enableDefaultRc: !flags.noDefaultRc,
      extraneousYarnrcFiles: flags.useYarnrc,
    },
    reporter,
  );
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
  name: string | {source?: string, cwd: string},
  checkInstalled: ?(config: Config, reporter: R, install: T, getStdout: () => string) => ?Promise<void>,
  beforeInstall: ?(cwd: string) => ?Promise<void>,
): Promise<void> {
  let out = '';
  const stdout = new stream.Writable({
    decodeStrings: false,
    write(data, encoding, cb) {
      out += data;
      cb();
    },
  });

  const reporter = new Reporter({stdout, stderr: stdout});

  let cwd;
  if (fixturesLoc) {
    const source = typeof name === 'string' ? name : name.source;

    // if source wasn't set then assume we were given a complete path
    if (typeof source === 'undefined') {
      cwd = typeof name !== 'string' ? name.cwd : await fs.makeTempDir();
    } else {
      const dir = path.join(fixturesLoc, source);
      cwd = await fs.makeTempDir(path.basename(dir));
      await fs.copy(dir, cwd, reporter);
      if (typeof name !== 'string') {
        cwd = path.join(cwd, name.cwd);
      }
    }
  } else {
    // if fixture loc is not set then CWD is some empty temp dir
    cwd = await fs.makeTempDir();
  }

  for (const {basename, absolute} of await fs.walk(cwd)) {
    if (basename.toLowerCase() === '.ds_store') {
      await fs.unlink(absolute);
    }
  }

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

  // make sure the cache folder been created in temp folder
  if (flags.cacheFolder) {
    flags.cacheFolder = path.join(cwd, flags.cacheFolder);
  }

  try {
    const config = await makeConfigFromDirectory(cwd, reporter, flags);
    if (typeof flags.workspacesNohoistEnabled === 'boolean') {
      config.workspacesNohoistEnabled = flags.workspacesNohoistEnabled;
    }
    const install = await factory(args, flags, config, reporter, lockfile, () => out);

    if (checkInstalled) {
      await checkInstalled(config, reporter, install, () => out);
    }
  } catch (err) {
    throw new Error(`${err && err.stack} \nConsole output:\n ${out}`);
  } finally {
    reporter.close();
    await fs.unlink(cwd);
  }
}
