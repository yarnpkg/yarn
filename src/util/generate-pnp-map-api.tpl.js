/* eslint-disable max-len, flowtype/require-valid-file-annotation, flowtype/require-return-type */
/* global packageInformationStores */

const Module = require('module');

const builtinModules = Module.builtinModules || Object.keys(process.binding('natives'));

const originalLoader = Module._load;
const originalResolver = Module._resolveFilename;

const pathRegExp = /^(?!\.{0,2}\/)([^\/]+)(\/.*|)$/;

const topLevelLocator = {name: null, reference: null};

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

  const [, dependencyName, subPath] = dependencyNameMatch;

  const packageInformation = exports.getPackageInformation(packageLocator);

  if (!packageInformation) {
    throw new Error(
      `Couldn't find a matching entry in the dependency tree for the specified parent (this is probably an internal error)`,
    );
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
      throw new Error(
        `Couldn't find the peer candidates for path "${parentPath}" (this is probably an internal error)`,
      );
    }

    const peerReference = peerResolutions.get(dependencyName);

    if (peerReference === null) {
      throw new Error(
        `Package "${packageLocator.name}" tries to access a missing peer dependency ("${dependencyName}")`,
      );
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
      throw new Error(
        `Package ${packageLocator.name}@${packageLocator.reference} is trying to require package ${dependencyName}, which is not declared in its dependencies (${Array.from(
          packageInformation.packageDependencies.keys(),
        ).join(`, `)})`,
      );
    } else {
      throw new Error(`You cannot require a package (${dependencyName}) that is not declared in your dependencies`);
    }
  }

  // We need to check that the package exists on the filesystem, because it might not have been installed

  const dependencyLocator = {name: dependencyName, reference: dependencyReference};
  const dependencyInformation = exports.getPackageInformation(dependencyLocator);

  const dependencyLocation = dependencyInformation.packageLocation;

  if (!dependencyLocation) {
    throw new Error(
      `Package ${dependencyName}@${dependencyReference} is a valid dependency, but hasn't been installed and thus cannot be required`,
    );
  }

  const path = `${dependencyLocation}/${subPath}`;
  const cacheKey = isPeerDependency ? `${parentPath}@${path}` : path;

  return {locator: dependencyLocator, path, cacheKey};
};

exports.setup = function setup(initialParentPath) {
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
        throw new Error(
          `Could not find package "${dependencyName} in the dependencies of your project (this is probably an internal error)`,
        );
      } else {
        throw new Error(
          `Could not find package "${dependencyName} in the dependencies of "${currentPath}" (this is probably an internal error)`,
        );
      }
    }

    initialParentLocator = {name: dependencyName, reference: dependencyReference};
  }

  Module._load = function(request, parent, isMain) {
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
      module[pnpPackagePath] = parentPath ? `${parentPath}/${resolution.locator.name}` : resolution.locator.name;
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

  Module._resolveFilename = function(request, parent, isMain, options) {
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
  exports.setup(process.env.YARN_PNP_PATH ? process.env.YARN_PNP_PATH.split(/\//g) : []);
}
