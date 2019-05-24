/* @flow */

import * as fs from '../../util/fs.js';
import path from 'path';

import type Config from '../../config.js';
import type {Reporter} from '../../reporters/index.js';

import {MessageError} from '../../errors.js';
import Lockfile from '../../lockfile';
import ResolutionMap from '../../resolution-map.js';
import {Install} from './install.js';
import PackageResolver from '../../package-resolver.js';
import * as constants from '../../constants.js';
import {stringify as lockStringify} from '../../lockfile';

export function setFlags(commander: Object) {
  commander.description('Resolves merge conflict markers in yarn.lock');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const lockfile = await Lockfile.fromDirectory(config.lockfileFolder, reporter);

  if (!lockfile.parseResultType) {
    throw new MessageError(reporter.lang('mergeLockfileMissing'));
  } else if (lockfile.parseResultType === 'conflict') {
    throw new MessageError(reporter.lang('mergeLockfileUnresolvedConflict'));
  } else if (lockfile.parseResultType === 'success') {
    reporter.info(reporter.lang('mergeLockfileNoConflict'));
    return;
  }

  const install = new Install(flags, config, reporter, lockfile);
  const resolutionMap = new ResolutionMap(config); // Selective resolutions for nested dependencies
  const {requests: depRequests, workspaceLayout} = await install.fetchRequestFromCwd([], false, resolutionMap);

  const resolver = new PackageResolver(config, lockfile, resolutionMap);
  await resolver.init(depRequests, {workspaceLayout});
  const resolvedPatterns = resolver.resolveNonWorkspacePatterns();

  const lockfileBasedOnResolver = lockfile.getLockfile(resolvedPatterns);

  // write lockfile
  const lockfileLoc = path.join(config.lockfileFolder, constants.LOCKFILE_FILENAME);
  const lockSource = lockStringify(lockfileBasedOnResolver, false, config.enableLockfileVersions);
  await fs.writeFilePreservingEol(lockfileLoc, lockSource);

  reporter.success(reporter.lang('savedLockfile'));
}
