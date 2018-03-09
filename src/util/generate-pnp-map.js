// @flow

import type Config from '../config.js';
import type PackageRequest from '../package-request.js';
import type PackageResolver from '../package-resolver.js';
import type {Manifest} from '../types.js';
import * as fs from './fs.js';

const invariant = require('invariant');
const path = require('path');

type PackageInformation = {|
  packageLocation: string,
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

    for (const [packageReference, {packageLocation, packageDependencies, packagePeers}] of packageInformationStore) {
      code += `    [${JSON.stringify(packageReference)}, {\n`;
      code += `      packageLocation: ${JSON.stringify(packageLocation)},\n`;

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

/* eslint-disable max-len */
const PROLOGUE = `
const path = require('path');

const topLevelLocator = {name: null, reference: null};

`.replace(/^\n/, ``);
/* eslint-enable max-len */

/* eslint-disable max-len */
const REQUIRE_HOOK = lockfileFolder =>
  `
const Module = require('module');

const builtinModules = Module.builtinModules || Object.keys(process.binding('natives'));

const originalLoader = Module._load;
const originalResolver = Module._resolveFilename;

const pathRegExp = /^(?!\\.{0,2}\\/)([^\\/]+)(\\/.*|)$/;

const pnpPackageLocator = Symbol('pnpPackageLocator');
const pnpPackagePath = Symbol('pnpPackagePath');

const moduleCache = new Map();

exports.getPackageInformation = function getPackageInformation({name, reference}) {
  const packageInformationStore = packageInformationStores.get(name);

  if (!packageInformationStore) {
    return null;
  }

  const packageInformation = packageInformationStore.get(reference);

  if (!packageInformation) {
    return null;
  }

  return packageInformation;
};

exports.resolveRequest = function resolveFilename(request, packageLocator, parentPath) {
  if (builtinModules.indexOf(request) !== -1) {
    return null;
  }

  const dependencyNameMatch = request.match(pathRegExp);

  if (!dependencyNameMatch) {
    return null;
  }

  const [ , dependencyName, subPath ] = dependencyNameMatch;

  const packageInformation = exports.getPackageInformation(packageLocator);

  if (!packageInformation) {
    throw new Error(\`Couldn't find a matching entry in the dependency tree for the specified parent (this is probably an internal error)\`);
  }

  // We obtain the dependency reference in regard to the package that request it
  // We also need to keep track of whether the dependency had to be loaded through a peerDependency entry
  // This is because in this case, the cache key must reflect it

  let dependencyReference = packageInformation.packageDependencies.get(dependencyName);
  let isPeerDependency = false;

  // If there's no strict dependency that match the request, we look into peer dependencies

  if (!dependencyReference && packageInformation.packagePeers) {
    const peerResolutions = packageInformation.packagePeers.get(parentPath);

    if (!peerResolutions) {
      throw new Error(\`Couldn't find the peer candidates for path "\${parentPath}" (this is probably an internal error)\`);
    }

    const peerReference = peerResolutions.get(dependencyName);

    if (peerReference === null) {
      throw new Error(\`Package "\${packageLocator.name}" tries to access a missing peer dependency ("\${dependencyName}")\`);
    }

    dependencyReference = peerReference;
    isPeerDependency = true;
  }

  // If we STILL can't find it, we fallback to the top-level dependencies
  // This fallback isn't ideal, but makes working with plugins much easier

  if (!dependencyReference) {
    const topLevelInformation = exports.getPackageInformation(topLevelLocator);

    dependencyReference = topLevelInformation.packageDependencies.get(dependencyName);
  }

  // And if we still haven't been able to resolve it, we give up
  // If the package making the request is the top-level, we can be a bit nicer in the error message

  if (!dependencyReference) {
    if (packageLocator !== topLevelLocator) {
      throw new Error(\`Package \${packageLocator.name}@\${packageLocator.reference} is trying to require package \${dependencyName}, which is not declared in its dependencies (\${Array.from(packageInformation.packageDependencies.keys()).join(\`, \`)})\`);
    } else {
      throw new Error(\`You cannot require a package (\${dependencyName}) that is not declared in your dependencies\`);
    }
  }

  // We need to check that the package exists on the filesystem, because it might not have been installed

  const dependencyLocator = {name: dependencyName, reference: dependencyReference};
  const dependencyInformation = exports.getPackageInformation(dependencyLocator);

  const dependencyLocation = dependencyInformation.packageLocation;

  if (!dependencyLocation) {
    throw new Error(\`Package \${dependencyName}@\${dependencyReference} is a valid dependency, but hasn't been installed and thus cannot be required\`);
  }

  const path = \`\${dependencyLocation}/\${subPath}\`;
  const cacheKey = isPeerDependency ? \`\${parentPath}@\${path}\` : path;

  return {locator: dependencyLocator, path, cacheKey};
}

exports.setup = function setup (initialParentPath) {
  let initialParentLocator = topLevelLocator;

  for (let t = 0; t < initialParentPath.length; ++t) {
    const dependencies = exports.getPackageInformation(initialParentLocator);
    const currentPath = initialParentPath.slice(0, t).join('/');

    const dependencyName = initialParentPath[t];
    let dependencyReference = dependencies.packageDependencies.get(dependencyName);

    if (!dependencyReference && dependencies.packagePeers) {
      const peerResolutions = dependencies.packagePeers.get(currentPath);

      if (peerResolutions) {
        dependencyReference = peerResolutions.get(dependencyName);
      }
    }

    if (!dependencyReference) {
      if (initialParentLocator === topLevelLocator) {
        throw new Error(\`Could not find package "\${dependencyName} in the dependencies of your project (this is probably an internal error)\`);
      } else {
        throw new Error(\`Could not find package "\${dependencyName} in the dependencies of "\${currentPath}" (this is probably an internal error)\`);
      }
    }

    initialParentLocator = {name: dependencyName, reference: dependencyReference};
  }

  Module._load = function (request, parent, isMain) {
    if (builtinModules.indexOf(request) !== -1) {
      return originalLoader.call(this, request, parent, isMain);
    }

    const parentLocator = parent && parent[pnpPackageLocator] ? parent[pnpPackageLocator] : initialParentLocator;
    const parentPath = parent && parent[pnpPackagePath] ? parent[pnpPackagePath] : initialParentPath;

    const resolution = exports.resolveRequest(request, parentLocator, parentPath);
    const qualifiedPath = originalResolver.call(this, resolution ? resolution.path : request, parent, isMain);

    const cacheKey = resolution ? resolution.cacheKey : qualifiedPath;
    const cacheEntry = moduleCache.get(cacheKey);

    if (cacheEntry) {
      return cacheEntry.exports;
    }

    const module = new Module(qualifiedPath, parent);
    moduleCache.set(cacheKey, module);

    if (isMain) {
      process.mainModule = module;
      module.id = '.';
    }

    if (resolution) {
      module[pnpPackageLocator] = resolution.locator;
      module[pnpPackagePath] = parentPath ? \`\${parentPath}/\${resolution.locator.name}\` : resolution.locator.name;
    } else {
      module[pnpPackageLocator] = parentLocator;
      module[pnpPackagePath] = parentPath;
    }

    let hasThrown = true;

    try {
      module.load(qualifiedPath);
      hasThrown = false;
    } finally {
      if (hasThrown) {
        moduleCache.delete(cacheKey);
      }
    }

    return module.exports;
  };

  Module._resolveFilename = function (request, parent, isMain, options) {
    if (builtinModules.indexOf(request) !== -1) {
      return request;
    }

    const parentLocator = parent && parent[pnpPackageLocator] ? parent[pnpPackageLocator] : topLevelLocator;
    const parentPath = parent && parent[pnpPackagePath] ? parent[pnpPackagePath] : '';

    const resolution = exports.resolveRequest(request, parentLocator, parentPath);
    const qualifiedPath = originalResolver.call(this, resolution ? resolution.path : request, parent, isMain);

    return qualifiedPath;
  };
};

if (module.parent && module.parent.id === 'internal/preload') {
  exports.setup(process.env.YARN_PNP_PATH ? process.env.YARN_PNP_PATH.split(/\\//g) : []);
}
`.replace(/^\n/, ``);
/* eslint-enable */

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
  {resolver, exclude}: {resolver: PackageResolver, exclude: Array<string>},
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

      // Resolve all the dependencies for our package

      const packageDependencies = new Map();

      for (const pattern of ref.dependencies) {
        const dep = resolver.getStrictResolvedPattern(pattern);
        packageDependencies.set(dep.name, dep.version);
      }

      // Compute the peer dependencies for each possible require path

      const packagePeers = getPackagePeers(pkg, {resolver, exclude: Array.from(packageDependencies.keys())});

      packageInformationStore.set(pkg.version, {
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

  return [PROLOGUE, generateMaps(packageInformationStores), REQUIRE_HOOK(config.lockfileFolder)].join(`\n`);
}
