/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import Lockfile from '../../src/lockfile/wrapper.js';
import {Reporter} from '../../src/reporters/index.js';
import {parse} from '../../src/lockfile/wrapper.js';
import * as reporters from '../../src/reporters/index.js';
import * as constants from '../../src/constants.js';
import {run as check} from '../../src/cli/commands/check.js';
import * as fs from '../../src/util/fs.js';
import {Install} from '../../src/cli/commands/install.js';
import Config from '../../src/config.js';

let stream = require('stream');
let path = require('path');

let fixturesLoc = path.join(__dirname, '..', 'fixtures', 'install');

export async function runInstall(
  flags: Object,
  name: string,
  checkInstalled?: ?(config: Config, reporter: Reporter) => ?Promise<void>,
  beforeInstall?: ?(cwd: string) => ?Promise<void>,
): Promise<void> {
  return run((config, reporter, lockfile): Install => {
    return new Install(flags, config, reporter, lockfile);
  }, path.join(fixturesLoc, name), checkInstalled, beforeInstall);
}

export async function clean(cwd: string, removeLock?: boolean) {
  await fs.unlink(path.join(cwd, constants.MODULE_CACHE_DIRECTORY));
  await fs.unlink(path.join(cwd, 'node_modules'));
  if (removeLock) {
    await fs.unlink(path.join(cwd, constants.LOCKFILE_FILENAME));
  }
}

export async function createLockfile(dir: string): Promise<Lockfile> {
  let lockfileLoc = path.join(dir, constants.LOCKFILE_FILENAME);
  let lockfile;

  if (await fs.exists(lockfileLoc)) {
    let rawLockfile = await fs.readFile(lockfileLoc);
    lockfile = parse(rawLockfile);
  }

  return new Lockfile(lockfile);
}

export function explodeLockfile(lockfile: string): Array<string> {
  return lockfile.split('\n').filter((line): boolean => !!line && line[0] !== '#');
}

export async function getPackageVersion(config: Config, packagePath: string): Promise<string> {
  let loc = path.join(config.cwd, `node_modules/${packagePath.replace(/\//g, '/node_modules/')}/package.json`);
  let json = JSON.parse(await fs.readFile(loc));
  return json.version;
}

export async function run(
  factory: (config: Config, reporter: Reporter, lockfile: Lockfile) => Install,
  cwd: string,
  checkInstalled: ?(config: Config, reporter: Reporter) => ?Promise<void>,
  beforeInstall: ?(cwd: string) => ?Promise<void>,
): Promise<void> {
  let out = '';
  let stdout = new stream.Writable({
    decodeStrings: false,
    write(data, encoding, cb) {
      out += data;
      cb();
    },
  });

  let reporter = new reporters.ConsoleReporter({stdout, stderr: stdout});

  if (beforeInstall) {
    await beforeInstall(cwd);
  }

  // remove the lockfile if we create one and it didn't exist before
  let removeLock = !(await fs.exists(path.join(cwd, constants.LOCKFILE_FILENAME)));
  let lockfile = await createLockfile(cwd);

  // clean up if we weren't successful last time
  await clean(cwd);

  // create directories
  await fs.mkdirp(path.join(cwd, constants.MODULE_CACHE_DIRECTORY));
  await fs.mkdirp(path.join(cwd, 'node_modules'));

  try {
    let config = new Config(reporter, {cwd});
    await config.init();

    let install = factory(config, reporter, lockfile);
    await install.init();
    // self check to verify consistency after installation
    await check(config, reporter, {}, []);
    try {
      if (checkInstalled) {
        await checkInstalled(config, reporter);
      }
    } finally {
      // clean up
      await clean(cwd, removeLock);
    }
  } catch (err) {
    throw new Error(`${err && err.stack} \nConsole output:\n ${out}`);
  }
}
