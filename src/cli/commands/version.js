/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {registryNames} from '../../registries/index.js';
import executeLifecycleScript from './_execute-lifecycle-script.js';
import {MessageError} from '../../errors.js';
import {spawn} from '../../util/child.js';
import * as fs from '../../util/fs.js';

const invariant = require('invariant');
const semver = require('semver');
const path = require('path');

const NEW_VERSION_FLAG = '--new-version [version]';
function isValidNewVersion(oldVersion: string, newVersion: string, looseSemver: boolean): boolean {
  return !!(semver.valid(newVersion, looseSemver) || semver.inc(oldVersion, newVersion, looseSemver));
}

export function setFlags(commander: Object) {
  commander.option(NEW_VERSION_FLAG, 'new version');
  commander.option('--message [message]', 'message');
}

export async function setVersion(
 config: Config,
 reporter: Reporter,
 flags: Object,
 args: Array<string>,
 required: boolean,
): Promise<() => Promise<void>> {
  const pkg = await config.readRootManifest();
  const pkgLoc = pkg._loc;
  let newVersion = flags.newVersion;
  invariant(pkgLoc, 'expected package location');

  if (args.length && !newVersion) {
    throw new MessageError(reporter.lang('invalidVersionArgument', NEW_VERSION_FLAG));
  }

  // get old version
  let oldVersion = pkg.version;
  if (oldVersion) {
    reporter.info(`${reporter.lang('currentVersion')}: ${oldVersion}`);
  } else {
    oldVersion = '0.0.0';
  }

  // get new version
  if (newVersion && !isValidNewVersion(oldVersion, newVersion, config.looseSemver)) {
    throw new MessageError(reporter.lang('invalidVersion'));
  }

  // wasn't passed a version arg so ask interactively
  while (!newVersion) {
    newVersion = await reporter.question(reporter.lang('newVersion'));

    if (!required && !newVersion) {
      return function(): Promise<void> {
        return Promise.resolve();
      };
    }

    if (isValidNewVersion(oldVersion, newVersion, config.looseSemver)) {
      break;
    } else {
      newVersion = null;
      reporter.error(reporter.lang('invalidSemver'));
    }
  }
  if (newVersion) {
    newVersion = semver.inc(oldVersion, newVersion, config.looseSemver) || newVersion;
  }
  invariant(newVersion, 'expected new version');

  if (newVersion === pkg.version) {
    throw new MessageError(reporter.lang('publishSame'));
  }

  await executeLifecycleScript(config, 'preversion');

  // update version
  reporter.info(`${reporter.lang('newVersion')}: ${newVersion}`);
  pkg.version = newVersion;

  // update versions in manifests
  const manifests = await config.getRootManifests();
  for (const registryName of registryNames) {
    const manifest = manifests[registryName];
    if (manifest.exists) {
      manifest.object.version = newVersion;
    }
  }
  await config.saveRootManifests(manifests);

  return async function(): Promise<void> {
    invariant(newVersion, 'expected version');

    // add git commit and tag
    let isGit = false;
    const parts = config.cwd.split(path.sep);
    while (parts.length) {
      isGit = await fs.exists(path.join(parts.join(path.sep), '.git'));
      if (isGit) {
        break;
      } else {
        parts.pop();
      }
    }
    if (isGit && Boolean(config.getOption('version-git-tag'))) {
      const message = (flags.message || String(config.getOption('version-git-message'))).replace(/%s/g, newVersion);
      const sign: boolean = Boolean(config.getOption('version-sign-git-tag'));
      const flag = sign ? '-sm' : '-am';
      const prefix: string = String(config.getOption('version-tag-prefix'));

      // add manifest
      await spawn('git', ['add', pkgLoc]);

      // create git commit
      await spawn('git', ['commit', '-m', message]);

      // create git tag
      await spawn('git', ['tag', `${prefix}${newVersion}`, flag, message]);
    }

    await executeLifecycleScript(config, 'postversion');
  };
}

export async function run(
 config: Config,
 reporter: Reporter,
 flags: Object,
 args: Array<string>,
): Promise<void> {
  const commit = await setVersion(config, reporter, flags, args, true);
  await commit();
}
