/* @flow */


import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {Install} from './install.js';
import Lockfile from '../../lockfile/wrapper.js';
import * as fs from '../../util/fs.js';

export const requireLockfile = true;

const invariant = require('invariant');
const emoji = require('node-emoji');
const path = require('path');

async function cleanQuery(config: Config, query: string): Promise<string> {
  // if a location was passed then turn it into a hash query
  if (path.isAbsolute(query) && await fs.exists(query)) {
    // absolute path
    query = path.relative(config.cwd, query);
  }

  // remove references to node_modules with hashes
  query = query.replace(/([\\/]|^)node_modules[\\/]/g, '#');

  // remove trailing hashes
  query = query.replace(/^#+/g, '');

  // remove path after last hash
  query = query.replace(/[\\/](.*?)$/g, '');

  return query;
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  const query = await cleanQuery(config, args[0]);

  reporter.step(1, 3, reporter.lang('whyStart', args[0]), emoji.get('thinking_face'));

  // init
  reporter.step(2, 3, reporter.lang('whyInitGraph'), emoji.get('truck'));
  const lockfile = await Lockfile.fromDirectory(config.cwd, reporter);
  const install = new Install(flags, config, reporter, lockfile);
  let [depRequests, patterns] = await install.fetchRequestFromCwd();
  await install.resolver.init(depRequests, install.flags.flat);
  const hoisted = await install.linker.getFlatHoistedTree(patterns);

  // finding
  reporter.step(3, 3, reporter.lang('whyFinding'), emoji.get('mag'));

  let match;
  for (let [, info] of hoisted) {
    if (info.key === query || info.previousKeys.indexOf(query) >= 0) {
      match = info;
      break;
    }
  }

  if (!match) {
    reporter.error(reporter.lang('whyUnknownMatch'));
    return;
  }

  const matchRef = match.pkg._reference;
  invariant(matchRef, 'expected reference');

  const matchPatterns = matchRef.patterns;
  const matchRequests = matchRef.requests;


  // reason: hoisted
  if (query === match.originalKey) {
    reporter.info(reporter.lang('whyHoistedTo', match.key));
  }

  const reasons = [];
  // reason: dependency of these modules
  for (const request of matchRequests) {
    const parentRequest = request.parentRequest;
    if (!parentRequest) {
      continue;
    }

    const dependent = install.resolver.getResolvedPattern(parentRequest.pattern);
    if (!dependent) {
      continue;
    }

    const chain = [];

    let delegator = parentRequest;
    do {
      chain.push(install.resolver.getStrictResolvedPattern(delegator.pattern).name);
    } while (delegator = delegator.parentRequest);

    reasons.push({
      type: 'whyDependedOn',
      typeSimple: 'whyDependedOnSimple',
      value: chain.reverse().join('#'),
    });
  }

  // reason: exists in manifest
  let rootType;
  for (const pattern of matchPatterns) {
    rootType = install.rootPatternsToOrigin[pattern];
    if (rootType) {
      reasons.push({
        type: 'whySpecified',
        typeSimple: 'whySpecifiedSimple',
        value: rootType,
      });
    }
  }

  // reason: this is hoisted from these modules
  for (const pattern of match.previousKeys) {
    if (pattern !== match.key) {
      reasons.push({
        type: 'whyHoistedFrom',
        typeSimple: 'whyHoistedFromSimple',
        value: pattern,
      });
    }
  }

  //
  if (reasons.length === 1) {
    reporter.info(reporter.lang(reasons[0].typeSimple, reasons[0].value));
  } else if (reasons.length > 1) {
    reporter.info(reporter.lang('whyReasons'));
    reporter.list('reasons', reasons.map(
      (reason) => reporter.lang(reason.type, reason.value)),
    );
  } else {
    reporter.error(reporter.lang('whyWhoKnows'));
  }

  // stats: file size of this dependency without any dependencies
  reporter.info(reporter.lang('whyDiskSizeWithout', '0MB'));

  // stats: file size of this dependency including dependencies that aren't shared
  reporter.info(reporter.lang('whyDiskSizeUnique', '0MB'));

  // stats: file size of this dependency including dependencies
  reporter.info(reporter.lang('whyDiskSizeTransitive', '0MB'));

  // stats: shared transitive dependencies
  reporter.info(reporter.lang('whySharedDependencies', 0));
}
