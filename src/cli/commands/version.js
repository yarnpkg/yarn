/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {registryNames} from '../../registries/index.js';
import {execCommand} from '../../util/execute-lifecycle-script.js';
import {MessageError} from '../../errors.js';
import {spawn as spawnGit} from '../../util/git/git-spawn.js';
import * as fs from '../../util/fs.js';
import map from '../../util/map.js';

const invariant = require('invariant');
const semver = require('semver');
const path = require('path');

const NEW_VERSION_FLAG = '--new-version [version]';
function isValidNewVersion(oldVersion: string, newVersion: string, looseSemver: boolean, identifier?: string): boolean {
  return !!(semver.valid(newVersion, looseSemver) || semver.inc(oldVersion, newVersion, looseSemver, identifier));
}

export function setFlags(commander: Object) {
  commander.description('Update the version of your package via the command line.');
  commander.option(NEW_VERSION_FLAG, 'new version');
  commander.option('--major', 'auto-increment major version number');
  commander.option('--minor', 'auto-increment minor version number');
  commander.option('--patch', 'auto-increment patch version number');
  commander.option('--premajor', 'auto-increment premajor version number');
  commander.option('--preminor', 'auto-increment preminor version number');
  commander.option('--prepatch', 'auto-increment prepatch version number');
  commander.option('--prerelease', 'auto-increment prerelease version number');
  commander.option('--preid [preid]', 'add a custom identifier to the prerelease');
  commander.option('--message [message]', 'message');
  commander.option('--no-git-tag-version', 'no git tag version');
  commander.option('--no-commit-hooks', 'bypass git hooks when committing new version');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
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
  const scripts = map();
  let newVersion = flags.newVersion;
  let identifier = undefined;
  if (flags.preid) {
    identifier = flags.preid;
  }
  invariant(pkgLoc, 'expected package location');

  if (args.length && !newVersion) {
    throw new MessageError(reporter.lang('invalidVersionArgument', NEW_VERSION_FLAG));
  }

  function runLifecycle(lifecycle: string): Promise<void> {
    if (scripts[lifecycle]) {
      return execCommand({stage: lifecycle, config, cmd: scripts[lifecycle], cwd: config.cwd, isInteractive: true});
    }

    return Promise.resolve();
  }

  function isCommitHooksDisabled(): boolean {
    return flags.commitHooks === false || config.getOption('version-commit-hooks') === false;
  }

  if (pkg.scripts) {
    // inherit `scripts` from manifest
    Object.assign(scripts, pkg.scripts);
  }

  // get old version
  let oldVersion = pkg.version;
  if (oldVersion) {
    reporter.info(`${reporter.lang('currentVersion')}: ${oldVersion}`);
  } else {
    oldVersion = '0.0.0';
  }

  // get new version
  if (newVersion && !isValidNewVersion(oldVersion, newVersion, config.looseSemver, identifier)) {
    throw new MessageError(reporter.lang('invalidVersion'));
  }

  // get new version by bumping old version, if requested
  if (!newVersion) {
    if (flags.major) {
      newVersion = semver.inc(oldVersion, 'major');
    } else if (flags.minor) {
      newVersion = semver.inc(oldVersion, 'minor');
    } else if (flags.patch) {
      newVersion = semver.inc(oldVersion, 'patch');
    } else if (flags.premajor) {
      newVersion = semver.inc(oldVersion, 'premajor', identifier);
    } else if (flags.preminor) {
      newVersion = semver.inc(oldVersion, 'preminor', identifier);
    } else if (flags.prepatch) {
      newVersion = semver.inc(oldVersion, 'prepatch', identifier);
    } else if (flags.prerelease) {
      newVersion = semver.inc(oldVersion, 'prerelease', identifier);
    }
  }

  // wasn't passed a version arg so ask interactively
  while (!newVersion) {
    // make sure we're not running in non-interactive mode before asking for new version
    if (flags.nonInteractive || config.nonInteractive) {
      // if no version is specified, use current version in package.json
      newVersion = oldVersion;
      break;
    }

    // Make sure we dont exit with an error message when pressing Ctrl-C or enter to abort
    try {
      newVersion = await reporter.question(reporter.lang('newVersion'));
      if (!newVersion) {
        newVersion = oldVersion;
      }
    } catch (err) {
      newVersion = oldVersion;
    }

    if (!required && !newVersion) {
      reporter.info(`${reporter.lang('noVersionOnPublish')}: ${oldVersion}`);
      return function(): Promise<void> {
        return Promise.resolve();
      };
    }

    if (isValidNewVersion(oldVersion, newVersion, config.looseSemver, identifier)) {
      break;
    } else {
      newVersion = null;
      reporter.error(reporter.lang('invalidSemver'));
    }
  }
  if (newVersion) {
    newVersion = semver.inc(oldVersion, newVersion, config.looseSemver, identifier) || newVersion;
  }
  invariant(newVersion, 'expected new version');

  if (newVersion === pkg.version) {
    return function(): Promise<void> {
      return Promise.resolve();
    };
  }

  await runLifecycle('preversion');

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

  await runLifecycle('version');

  return async function(): Promise<void> {
    invariant(newVersion, 'expected version');

    // check if a new git tag should be created
    if (flags.gitTagVersion && config.getOption('version-git-tag')) {
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

      if (isGit) {
        const message = (flags.message || String(config.getOption('version-git-message'))).replace(/%s/g, newVersion);
        const sign: boolean = Boolean(config.getOption('version-sign-git-tag'));
        const flag = sign ? '-sm' : '-am';
        const prefix: string = String(config.getOption('version-tag-prefix'));
        const args: Array<string> = ['commit', '-m', message, ...(isCommitHooksDisabled() ? ['-n'] : [])];

        const gitRoot = (await spawnGit(['rev-parse', '--show-toplevel'], {cwd: config.cwd})).trim();

        // add manifest
        await spawnGit(['add', path.relative(gitRoot, pkgLoc)], {cwd: gitRoot});

        // create git commit
        await spawnGit(args, {cwd: gitRoot});

        // create git tag
        await spawnGit(['tag', `${prefix}${newVersion}`, flag, message], {cwd: gitRoot});
      }
    }

    await runLifecycle('postversion');
  };
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const commit = await setVersion(config, reporter, flags, args, true);
  await commit();
}
