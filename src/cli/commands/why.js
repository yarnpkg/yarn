/* @flow */

import type {HoistManifest} from '../../package-hoister.js';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';

import {Install} from './install.js';
import {METADATA_FILENAME, TARBALL_FILENAME} from '../../constants.js';
import * as fs from '../../util/fs.js';
import Lockfile from '../../lockfile/wrapper.js';

export const requireLockfile = true;

const bytes = require('bytes');
const emoji = require('node-emoji');
const invariant = require('invariant');
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

async function getPackageSize(info: HoistManifest): Promise<number> {
  const files = await fs.walk(info.loc, null, new Set([
    METADATA_FILENAME,
    TARBALL_FILENAME,
  ]));
  const sizes = await Promise.all(
    files.map(
      (walkFile) => fs.stat(walkFile.absolute)
        .then((stat) => stat.size),
    ),
  );
  return sum(sizes);
}


const sum = (array) => array.length ? array.reduce((a, b) => a + b, 0) : 0;
const collect = (hoistManifests, allDependencies, dependency, {recursive} = {recursive: false}) => {
  const deps = dependency.pkg.dependencies;
  if (!deps) {
    return allDependencies;
  }

  const dependencyKeys = new Set(Object.keys(deps));
  const directDependencies = [];
  for (const [, info] of hoistManifests) {
    if (!allDependencies.has(info) && dependencyKeys.has(info.key)) {
      allDependencies.add(info);
      directDependencies.push(info);
    }
  }

  if (recursive) {
    directDependencies.forEach(
      (dependency) => collect(hoistManifests, allDependencies, dependency, {recursive: true}),
    );
  }

  return allDependencies;
};
const getSharedDependencies = (hoistManifests, transitiveKeys) => {
  const sharedDependencies = new Set();
  for (const [, info] of hoistManifests) {
    if (!transitiveKeys.has(info.key) && info.pkg.dependencies) {
      Object.keys(info.pkg.dependencies).forEach((dependency) => {
        if (transitiveKeys.has(dependency) && !sharedDependencies.has(dependency)) {
          sharedDependencies.add(dependency);
        }
      });
    }
  }
  return sharedDependencies;
};

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  const query = await cleanQuery(config, args[0]);

  reporter.step(1, 4, reporter.lang('whyStart', args[0]), emoji.get('thinking_face'));

  // init
  reporter.step(2, 4, reporter.lang('whyInitGraph'), emoji.get('truck'));
  const lockfile = await Lockfile.fromDirectory(config.cwd, reporter);
  const install = new Install(flags, config, reporter, lockfile);
  const [depRequests, patterns] = await install.fetchRequestFromCwd();
  await install.resolver.init(depRequests, install.flags.flat);
  const hoisted = await install.linker.getFlatHoistedTree(patterns);

  // finding
  reporter.step(3, 4, reporter.lang('whyFinding'), emoji.get('mag'));

  let match;
  for (const [, info] of hoisted) {
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

  // package sizes
  reporter.step(4, 4, reporter.lang('whyCalculating'), emoji.get('aerial_tramway'));

  const packageSize = await getPackageSize(match);
  const dependencies = Array.from(collect(hoisted, new Set(), match));
  const transitiveDependencies = Array.from(collect(hoisted, new Set(), match, {recursive: true}));

  const directSizes = await Promise.all(dependencies.map(getPackageSize));
  const transitiveSizes = await Promise.all(transitiveDependencies.map(getPackageSize));

  const transitiveKeys = new Set(transitiveDependencies.map((info) => info.key));
  const sharedDependencies = getSharedDependencies(hoisted, transitiveKeys);

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
  reporter.info(reporter.lang('whyDiskSizeWithout', bytes(packageSize)));

  // stats: file size of this dependency including dependencies that aren't shared
  reporter.info(reporter.lang('whyDiskSizeUnique', bytes(packageSize + sum(directSizes))));

  // stats: file size of this dependency including dependencies
  reporter.info(reporter.lang('whyDiskSizeTransitive', bytes(packageSize + sum(transitiveSizes))));

  // stats: shared transitive dependencies
  reporter.info(reporter.lang('whySharedDependencies', sharedDependencies.size));
}
