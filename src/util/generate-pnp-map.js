// @flow

import type Config from '../config.js';
import type PackageRequest from '../package-request.js';
import type PackageResolver from '../package-resolver.js';
import pnpApi from './generate-pnp-map-api.tpl.js';
import * as constants from '../constants.js';
import type {Manifest} from '../types.js';
import * as fs from './fs.js';

const invariant = require('invariant');
const path = require('path');

type PackageInformation = {|
  packageLocation: string,
  packageMainEntry: ?string,
  packageDependencies: Map<string, string>,
  packagePeers: Map<string, Map<string, string | null>>,
|};
type PackageInformationStore = Map<string | null, PackageInformation>;
type PackageInformationStores = Map<string | null, PackageInformationStore>;

function generateMaps(packageInformationStores: PackageInformationStores): string {
  let code = ``;

  // Bake the information stores into our generated code
  code += `let packageInformationStores = new Map([\n`;

  for (const [packageName, packageInformationStore] of packageInformationStores) {
    code += `  [${JSON.stringify(packageName)}, new Map([\n`;

    for (const [
      packageReference,
      {packageMainEntry, packageLocation, packageDependencies, packagePeers},
    ] of packageInformationStore) {
      code += `    [${JSON.stringify(packageReference)}, {\n`;
      code += `      packageLocation: ${JSON.stringify(packageLocation)},\n`;

      if (packageMainEntry) {
        code += `      packageMainEntry: ${JSON.stringify(packageMainEntry)},\n`;
      }

      code += `      packageDependencies: new Map([\n`;
      for (const [dependencyName, dependencyReference] of packageDependencies.entries()) {
        code += `        [${JSON.stringify(dependencyName)}, ${JSON.stringify(dependencyReference)}],\n`;
      }
      code += `      ]),\n`;

      if (packagePeers.size > 0) {
        code += `      packagePeers: new Map([\n`;
        for (const [dependencyPath, peerEntries] of packagePeers) {
          code += `        [${JSON.stringify(dependencyPath)}, new Map([\n`;
          for (const [dependencyName, dependencyReference] of peerEntries.entries()) {
            code += `          [${JSON.stringify(dependencyName)}, ${JSON.stringify(dependencyReference)}],\n`;
          }
          code += `        ])],\n`;
        }
        code += `      ]),\n`;
      }

      code += `    }],\n`;
    }

    code += `  ])],\n`;
  }

  code += `]);\n`;

  return code;
}

function getPackagesDistance(fromReq: PackageRequest, toReq: PackageRequest): number | null {
  // toReq cannot be a valid peer dependency if it's deeper in the tree
  if (toReq.parentNames.length > fromReq.parentNames.length) {
    return null;
  }

  // To be a valid peer dependency, toReq must have the same parents
  for (let t = 0; t < toReq.parentNames.length; ++t) {
    if (toReq.parentNames[t] !== fromReq.parentNames[t]) {
      return null;
    }
  }

  // The depth is simply the number of parents between the two packages
  return fromReq.parentNames.length - toReq.parentNames.length;
}

function getPackagePeers(
  pkg: Manifest,
  {resolver, exclude}: {resolver: PackageResolver, exclude: Set<string>},
): Map<string, Map<string, string | null>> {
  const ref = pkg._reference;
  invariant(ref, `Ref must exists`);

  // Early exit if the package has no peer dependency

  const peerDependencies = pkg.peerDependencies || {};
  const peerNames = new Set(Object.keys(peerDependencies));

  for (const excludeName of exclude) {
    peerNames.delete(excludeName);
  }

  if (peerNames.size === 0) {
    return new Map();
  }

  // Cache the candidates for each peer dependency

  const peerCandidateMap = new Map();

  for (const peerDependency of peerNames) {
    peerCandidateMap.set(peerDependency, resolver.getAllInfoForPackageName(peerDependency));
  }

  // Find the best candidates for each peer dependency for each branch that uses `pkg`

  const packagePeers = new Map();

  for (const req of ref.requests) {
    const peerPath = [...req.parentNames, ref.name].join('/');
    const peerEntries = new Map();

    for (const peerDependency of peerNames) {
      const peerCandidates = peerCandidateMap.get(peerDependency);
      invariant(peerCandidates, `We must have peer candidates`);

      let bestCandidate = null;
      let bestDepth = Infinity;

      for (const peerCandidate of peerCandidates) {
        const candidateRef = peerCandidate._reference;

        if (!candidateRef) {
          continue;
        }

        for (const candidateReq of candidateRef.requests) {
          const candidateDepth = getPackagesDistance(req, candidateReq);

          if (candidateDepth !== null && bestDepth > candidateDepth) {
            bestCandidate = peerCandidate;
            bestDepth = candidateDepth;
          }
        }
      }

      if (bestCandidate) {
        peerEntries.set(peerDependency, bestCandidate.version);
      } else {
        peerEntries.set(peerDependency, null);
      }
    }

    packagePeers.set(peerPath, peerEntries);
  }

  return packagePeers;
}

async function getPackageInformationStores(
  config: Config,
  seedPatterns: Array<string>,
  {resolver}: {resolver: PackageResolver},
): Promise<PackageInformationStores> {
  const packageInformationStores = new Map();

  const pkgs = resolver.getTopologicalManifests(seedPatterns);

  for (const pkg of pkgs) {
    if (pkg._reference && pkg._reference.location && pkg._reference.isPlugnplay) {
      const ref = pkg._reference;
      const loc = pkg._reference.location;

      let packageInformationStore = packageInformationStores.get(pkg.name);

      if (!packageInformationStore) {
        packageInformationStores.set(pkg.name, (packageInformationStore = new Map()));
      }

      // Get the dependency we directly own (vs those provided through peerDependencies)

      const ownedDependencies = new Set();

      for (const dependencyType of constants.OWNED_DEPENDENCY_TYPES) {
        if (pkg[dependencyType]) {
          for (const dependencyName of Object.keys(pkg[dependencyType])) {
            ownedDependencies.add(dependencyName);
          }
        }
      }

      // Resolve all the dependencies for our package

      const packageDependencies = new Map();

      for (const pattern of ref.dependencies) {
        const dep = resolver.getStrictResolvedPattern(pattern);
        if (ownedDependencies.has(dep.name)) {
          packageDependencies.set(dep.name, dep.version);
        }
      }

      // Compute the peer dependencies for each possible require path
      // In case of conflict, we use the one from dependencies / devDependencies / optionalDependencies

      const packagePeers = getPackagePeers(pkg, {resolver, exclude: ownedDependencies});

      packageInformationStore.set(pkg.version, {
        packageMainEntry: pkg.main,
        packageLocation: (await fs.realpath(loc)).replace(/[\\\/]?$/, path.sep),
        packageDependencies,
        packagePeers,
      });
    }
  }

  // Top-level package
  if (true) {
    const topLevelDependencies = new Map();

    for (const pattern of seedPatterns) {
      const dep = resolver.getStrictResolvedPattern(pattern);
      topLevelDependencies.set(dep.name, dep.version);
    }

    packageInformationStores.set(
      null,
      new Map([
        [
          null,
          {
            packageMainEntry: null,
            packageLocation: (await fs.realpath(config.lockfileFolder)).replace(/[\\\/]?$/, path.sep),
            packageDependencies: topLevelDependencies,
            packagePeers: new Map(),
          },
        ],
      ]),
    );
  }

  return packageInformationStores;
}

export async function generatePnpMap(
  config: Config,
  seedPatterns: Array<string>,
  {resolver}: {resolver: PackageResolver},
): Promise<string> {
  const packageInformationStores = await getPackageInformationStores(config, seedPatterns, {resolver});

  return (
    generateMaps(packageInformationStores) + pnpApi.replace(/\$\$LOCKFILE_FOLDER/g, JSON.stringify(config.lockfileFolder))
  );
}
