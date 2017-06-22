/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';

import type {HoistManifestTuple, HoistManifestTuples} from '../../package-hoister.js';
import {Install} from './install.js';
import {METADATA_FILENAME, TARBALL_FILENAME} from '../../constants.js';
import * as fs from '../../util/fs.js';
import Lockfile from '../../lockfile/wrapper.js';
import {MessageError} from '../../errors.js';

export const requireLockfile = true;

const invariant = require('invariant');
const bytes = require('bytes');
const emoji = require('node-emoji');
const path = require('path');

async function cleanQuery(config: Config, query: string): Promise<string> {
  // if a location was passed then turn it into a hash query
  if (path.isAbsolute(query) && (await fs.exists(query))) {
    // absolute path
    query = path.relative(config.cwd, query);
  }

  // remove references to node_modules with hashes
  query = query.replace(/([\\/]|^)node_modules[\\/]/g, '#');

  // remove trailing hashes
  query = query.replace(/^#+/g, '');

  // remove trailing paths from each part of the query, skip second part of path for scoped packages
  let queryParts = query.split('#');
  queryParts = queryParts.map((part: string): string => {
    let parts = part.split(/[\\/]/g);

    if (part[0] === '@') {
      parts = parts.slice(0, 2);
    } else {
      parts = parts.slice(0, 1);
    }

    return parts.join('/');
  });
  query = queryParts.join('#');

  return query;
}

async function getPackageSize(tuple: HoistManifestTuple): Promise<number> {
  const [loc] = tuple;

  const files = await fs.walk(loc, null, new Set([METADATA_FILENAME, TARBALL_FILENAME]));

  const sizes = await Promise.all(files.map(walkFile => fs.getFileSizeOnDisk(walkFile.absolute)));

  return sum(sizes);
}

function sum(array: Array<number>): number {
  return array.length ? array.reduce((a, b) => a + b, 0) : 0;
}

function collect(
  hoistManifests: HoistManifestTuples,
  allDependencies: Set<any>,
  dependency: HoistManifestTuple,
  {recursive}: {recursive?: boolean} = {recursive: false},
): Set<any> {
  const [, depInfo] = dependency;
  const deps = depInfo.pkg.dependencies;

  if (!deps) {
    return allDependencies;
  }

  const dependencyKeys = new Set(Object.keys(deps));
  const directDependencies = [];

  for (const dep of hoistManifests) {
    const [, info] = dep;

    if (!allDependencies.has(dep) && dependencyKeys.has(info.key)) {
      allDependencies.add(dep);
      directDependencies.push(dep);
    }
  }

  if (recursive) {
    directDependencies.forEach(dependency => collect(hoistManifests, allDependencies, dependency, {recursive: true}));
  }

  return allDependencies;
}

function getSharedDependencies(hoistManifests: HoistManifestTuples, transitiveKeys: Set<string>): Set<string> {
  const sharedDependencies = new Set();
  for (const [, info] of hoistManifests) {
    if (!transitiveKeys.has(info.key) && info.pkg.dependencies) {
      Object.keys(info.pkg.dependencies).forEach(dependency => {
        if (transitiveKeys.has(dependency) && !sharedDependencies.has(dependency)) {
          sharedDependencies.add(dependency);
        }
      });
    }
  }
  return sharedDependencies;
}

export function setFlags(commander: Object) {}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  if (!args.length) {
    throw new MessageError(reporter.lang('missingWhyDependency'));
  }
  if (args.length > 1) {
    throw new MessageError(reporter.lang('tooManyArguments', 1));
  }

  const query = await cleanQuery(config, args[0]);

  reporter.step(1, 4, reporter.lang('whyStart', args[0]), emoji.get('thinking_face'));

  // init
  reporter.step(2, 4, reporter.lang('whyInitGraph'), emoji.get('truck'));
  const lockfile = await Lockfile.fromDirectory(config.lockfileFolder, reporter);
  const install = new Install(flags, config, reporter, lockfile);
  const {requests: depRequests, patterns} = await install.fetchRequestFromCwd();
  await install.resolver.init(depRequests, {isFlat: install.flags.flat, isFrozen: install.flags.frozenLockfile});
  const hoisted = await install.linker.getFlatHoistedTree(patterns);

  // finding
  reporter.step(3, 4, reporter.lang('whyFinding'), emoji.get('mag'));

  let match;
  for (const [loc, info] of hoisted) {
    if (info.key === query || info.previousKeys.indexOf(query) >= 0) {
      match = [loc, info];
      break;
    }
  }

  if (!match) {
    reporter.error(reporter.lang('whyUnknownMatch'));
    return;
  }

  const [, matchInfo] = match;
  const matchRef = matchInfo.pkg._reference;
  invariant(matchRef, 'expected reference');

  const matchPatterns = matchRef.patterns;
  const matchRequests = matchRef.requests;

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
    } while ((delegator = delegator.parentRequest));

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
  for (const pattern of matchInfo.previousKeys) {
    if (pattern !== matchInfo.key) {
      reasons.push({
        type: 'whyHoistedFrom',
        typeSimple: 'whyHoistedFromSimple',
        value: pattern,
      });
    }
  }

  // package sizes
  reporter.step(4, 4, reporter.lang('whyCalculating'), emoji.get('aerial_tramway'));

  let packageSize = 0;
  let directSizes = [];
  let transitiveSizes = [];
  try {
    packageSize = await getPackageSize(match);
  } catch (e) {}

  const dependencies = Array.from(collect(hoisted, new Set(), match));
  const transitiveDependencies = Array.from(collect(hoisted, new Set(), match, {recursive: true}));

  try {
    directSizes = await Promise.all(dependencies.map(getPackageSize));
    transitiveSizes = await Promise.all(transitiveDependencies.map(getPackageSize));
  } catch (e) {}

  const transitiveKeys = new Set(transitiveDependencies.map(([, info]) => info.key));
  const sharedDependencies = getSharedDependencies(hoisted, transitiveKeys);

  //
  // reason: hoisted
  if (query === matchInfo.originalKey) {
    reporter.info(reporter.lang('whyHoistedTo', matchInfo.key));
  }

  if (reasons.length === 1) {
    reporter.info(reporter.lang(reasons[0].typeSimple, reasons[0].value));
  } else if (reasons.length > 1) {
    reporter.info(reporter.lang('whyReasons'));
    reporter.list('reasons', reasons.map(reason => reporter.lang(reason.type, reason.value)));
  } else {
    reporter.error(reporter.lang('whyWhoKnows'));
  }

  if (packageSize) {
    // stats: file size of this dependency without any dependencies
    reporter.info(reporter.lang('whyDiskSizeWithout', bytes(packageSize)));

    // stats: file size of this dependency including dependencies that aren't shared
    reporter.info(reporter.lang('whyDiskSizeUnique', bytes(packageSize + sum(directSizes))));

    // stats: file size of this dependency including dependencies
    reporter.info(reporter.lang('whyDiskSizeTransitive', bytes(packageSize + sum(transitiveSizes))));

    // stats: shared transitive dependencies
    reporter.info(reporter.lang('whySharedDependencies', sharedDependencies.size));
  }
}
