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

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import {stringify} from '../../util/misc.js';
import {spawn} from '../../util/child.js';
import * as fs from '../../util/fs.js';

let invariant = require('invariant');
let semver = require('semver');
let path = require('path');

function isValidNewVersion(oldVersion: string, newVersion: string): boolean {
  return !!(semver.valid(newVersion) || semver.inc(oldVersion, newVersion));
}

export function setFlags(commander: Object) {
  commander.option('--new-version [version]', 'new version');
  commander.option('--message [message]', 'message');
}

export async function run(
 config: Config,
 reporter: Reporter,
 flags: Object,
 args: Array<string>,
): Promise<void> {
  let pkg = await config.readManifest(config.cwd);

  if (!pkg.version) {
    throw new MessageError(`Package doesn't have a version`);
  }

  // get old version
  let oldVersion = pkg.version;
  reporter.info(`Current version ${oldVersion}`);

  // get new version
  let newVersion = flags.newVersion;
  if (newVersion && !isValidNewVersion(oldVersion, newVersion)) {
    throw new MessageError('Invalid version supplied');
  }

  // wasn't passed a version arg so ask interactively
  while (!newVersion) {
    newVersion = await reporter.question(`New version`);

    if (isValidNewVersion(oldVersion, newVersion)) {
      break;
    } else {
      newVersion = null;
      reporter.error('Invalid semver version');
    }
  }
  if (newVersion) {
    newVersion = semver.inc(oldVersion, newVersion) || newVersion;
  }
  invariant(newVersion, 'expected new version');

  // update version
  reporter.info(`New version ${newVersion}`);
  let json = await fs.readJson(pkg._loc);
  pkg.version = json.version = newVersion;
  await fs.writeFile(pkg._loc, `${stringify(json)}\n`);

  // add git commit and tag
  let isGit = false;
  let parts = config.cwd.split(path.sep);
  while (parts.length) {
    isGit = await fs.exists(path.join(parts.join(path.sep), '.git'));
    if (isGit) {
      break;
    } else {
      parts.pop();
    }
  }
  if (isGit) {
    let message = (flags.message || 'v%s').replace(/%s/g, newVersion);
    let sign = false; // TODO sign-git-tag npm config
    let flag = sign ? '-sm' : '-am';
    let prefix = 'v'; // TODO tag-version-prefix npm config

    // add manifest
    await spawn('git', ['add', pkg._loc]);

    // create git commit
    await spawn('git', ['commit', '-m', message]);

    // create git tag
    await spawn('git', ['tag', `${prefix}${newVersion}`, flag, message]);
  }
}
