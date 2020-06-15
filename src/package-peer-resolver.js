/* @flow */

import type {Manifest} from './types.js';
import type PackageReference from './package-reference.js';
import type PackageResolver from './package-resolver.js';
import type Config from './config.js';
import PackageRequest from './package-request.js';
import {satisfiesWithPrereleases} from './util/semver.js';
import type {Reporter} from './reporters/index.js';

const invariant = require('invariant');

function isWorkspaceRequest(req: PackageRequest): boolean {
  if (req.hint === 'workspaces') {
    return true;
  }
  if (req.hint || !req.parentRequest) {
    return false;
  }
  return req.parentRequest.hint === 'workspaces';
}

function getLevelDistance(pkgRef: PackageReference, refTree: string[]): number {
  let minDistance = Infinity;
  for (const req of pkgRef.requests) {
    if (isWorkspaceRequest(req)) {
      continue;
    }
    const distance = refTree.length - req.parentNames.length;

    if (distance >= 0 && distance < minDistance && req.parentNames.every((name, idx) => name === refTree[idx])) {
      minDistance = distance;
    }
  }

  return minDistance;
}

function getShortestPathOf(requests: PackageRequest[]): string[] {
  return requests
    .map((req: PackageRequest): string[] => req.parentNames)
    .sort((arr1: string[], arr2: string[]) => arr1.length - arr2.length)[0];
}

function extractRefTrees(ref: PackageReference): string[][] {
  if (!ref.requests.some(request => isWorkspaceRequest(request))) {
    return [getShortestPathOf(ref.requests)];
  }
  const initialMap: {[id: string]: PackageRequest[]} = {};
  const addOrSet = (map: {[id: string]: PackageRequest[]}, key: string, value: PackageRequest) => {
    const formerList = map[key];
    if (formerList) {
      formerList.push(value);
    } else {
      map[key] = [value];
    }
  };
  const refTrees: {
    [id: string]: PackageRequest[],
  } = ref.requests.reduce((map: {[id: string]: PackageRequest[]}, req: PackageRequest) => {
    if (isWorkspaceRequest(req)) {
      return map;
    }
    let {parentRequest} = req;
    while (parentRequest && !isWorkspaceRequest(parentRequest)) {
      parentRequest = parentRequest.parentRequest;
    }
    if (parentRequest) {
      addOrSet(map, parentRequest.pattern, req);
    } else {
      addOrSet(map, '', req);
    }
    return map;
  }, initialMap);
  return Object.keys(refTrees).sort().map(requestName => getShortestPathOf(refTrees[requestName]));
}

export default class PackagePeerResolver {
  constructor(config: Config, resolver: PackageResolver) {
    this.config = config;
    this.resolver = resolver;
    this.reporter = config.reporter;
  }

  reporter: Reporter;
  resolver: PackageResolver;
  config: Config;

  resolvePeerModules(pkgs: Array<Manifest>) {
    for (const pkg of pkgs) {
      const peerDeps = pkg.peerDependencies;
      const peerDepsMeta = pkg.peerDependenciesMeta;

      if (!peerDeps) {
        continue;
      }

      const ref = pkg._reference;
      invariant(ref, 'Package reference is missing');

      const refTrees = extractRefTrees(ref);

      if (refTrees.length === 0) {
        continue;
      }

      for (const peerDepName in peerDeps) {
        const range = peerDeps[peerDepName];
        const meta = peerDepsMeta && peerDepsMeta[peerDepName];

        const isOptional = !!(meta && meta.optional);

        const onNotResolved = isOptional
          ? (refTree, peerError) => {}
          : (refTree, peerError) => {
              this.reporter.warn(
                this.reporter.lang(
                  peerError,
                  `${refTree.join(' > ')} > ${pkg.name}@${pkg.version}`,
                  `${peerDepName}@${range}`,
                ),
              );
            };

        const peerPkgs = this.resolver.getAllInfoForPackageName(peerDepName);

        const refTreesStatus = [];
        for (let refTreeIndex = 0; refTreeIndex < refTrees.length; refTreeIndex++) {
          const refTree: string[] = refTrees[refTreeIndex];
          let peerError = 'unmetPeer';
          let resolvedLevelDistance: number = Infinity;
          let resolvedPeerPkg;
          for (const peerPkg of peerPkgs) {
            const peerPkgRef = peerPkg._reference;
            if (!(peerPkgRef && peerPkgRef.patterns)) {
              continue;
            }
            const levelDistance = getLevelDistance(peerPkgRef, refTree);
            if (isFinite(levelDistance) && levelDistance < resolvedLevelDistance) {
              if (this._satisfiesPeerDependency(range, peerPkgRef.version)) {
                resolvedLevelDistance = levelDistance;
                resolvedPeerPkg = peerPkgRef;
              } else {
                peerError = 'incorrectPeer';
              }
            }
          }
          refTreesStatus.push({
            refTree,
            peerError,
            resolvedPeerPkg,
          });
        }

        const {refTree, peerError, resolvedPeerPkg} = refTreesStatus[0];
        if (resolvedPeerPkg) {
          ref.addDependencies(resolvedPeerPkg.patterns);
          this.reporter.verbose(
            this.reporter.lang(
              'selectedPeer',
              `${pkg.name}@${pkg.version}`,
              `${peerDepName}@${resolvedPeerPkg.version}`,
              resolvedPeerPkg.level,
            ),
          );
        } else {
          onNotResolved(refTree, peerError);
        }
        for (let statusIndex = 1; statusIndex < refTreesStatus.length; statusIndex++) {
          const refTreeStatus = refTreesStatus[statusIndex];
          if (!refTreeStatus.resolvedPeerPkg) {
            onNotResolved(refTreeStatus.refTree, refTreeStatus.peerError);
          }
        }
      }
    }
  }

  _satisfiesPeerDependency(range: string, version: string): boolean {
    return range === '*' || satisfiesWithPrereleases(version, range, this.config.looseSemver);
  }
}
