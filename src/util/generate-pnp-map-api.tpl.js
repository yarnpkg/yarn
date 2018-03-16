/* eslint-disable max-len, flowtype/require-valid-file-annotation, flowtype/require-return-type */
/* global packageInformationStores */

const fs = require('fs');
const Module = require('module');
const path = require('path');

const builtinModules = Module.builtinModules || Object.keys(process.binding('natives'));

const originalLoader = Module._load;

const pathRegExp = /^(?!\.{0,2}(?:\/|$))((?:@[^\/]+\/)?[^\/]+)\/?(.*|)$/;
const isDirRegExp = /[\\\/]$/;

const topLevelLocator = {name: null, reference: null};

const moduleShims = new Map();
const moduleCache = new Map();

/**
 * Returns information about a package in a safe way (will throw if they cannot be retrieved)
 */

function getPackageInformationSafe(packageLocator) {
  const packageInformation = exports.getPackageInformation(packageLocator);

  if (!packageInformation) {
    throw new Error(
      `Couldn't find a matching entry in the dependency tree for the specified parent (this is probably an internal error)`,
    );
  }

  return packageInformation;
}

/**
 * Returns the peer dependency resolutions about a package in a given location in the dependency tree in a safe way
 * (will throw if they cannot be retrieved).
 */

function findPackageLocatorSafe(filesystemPath) {
  const packageLocator = exports.findPackageLocator(filesystemPath);

  if (!packageLocator) {
    throw new Error(`Couldn't find an owner for path "${filesystemPath}"`);
  }

  return packageLocator;
}

/**
 */

function applyNodeExtensionResolution(filesystemPath) {
  // If the file exists and is a file, we can stop right there

  let stat;

  try {
    stat = fs.statSync(filesystemPath);
  } catch (error) {}

  if (stat && !stat.isDirectory()) {
    return filesystemPath;
  }

  // Otherwise we check if we find a file that match one of the supported extensions

  const extensions = Object.keys(Module._extensions);

  const qualifiedFile = extensions
    .map(extension => {
      return `${filesystemPath}${extension}`;
    })
    .find(candidateFile => {
      return fs.existsSync(candidateFile);
    });

  if (qualifiedFile) {
    return qualifiedFile;
  }

  // Otherwise, we check if the path is a folder - in such a case, we try to use its index

  if (stat && stat.isDirectory()) {
    const indexFile = extensions
      .map(extension => {
        return `${filesystemPath}/index${extension}`;
      })
      .find(candidateFile => {
        return fs.existsSync(candidateFile);
      });

    if (indexFile) {
      return indexFile;
    }
  }

  // Otherwise there's nothing else we can do :(

  return null;
}

/**
 * Gets the package information for a given locator. Returns null if they cannot be retrieved.
 */

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

/**
 * Transforms a request (what's typically passed as argument to the require function) into a location on the
 * filesystem, amongst other data.
 *
 * It also returns the following information:
 *
 *  - The owning package locator
 *  - The owning package path in the dependency tree
 *  - The file cache key
 */

exports.resolveRequest = function resolveRequest(request, issuer) {
  // Bailout if the request is a native module

  if (builtinModules.indexOf(request) !== -1) {
    return request;
  }

  let filesystemPath;

  // If the request is a relative or absolute path, we just return it normalized

  const dependencyNameMatch = request.match(pathRegExp);

  if (!dependencyNameMatch) {
    if (issuer.match(isDirRegExp)) {
      filesystemPath = path.normalize(path.resolve(issuer, request));
    } else {
      filesystemPath = path.normalize(path.resolve(path.dirname(issuer), request));
    }
  }

  // Things are more hairy if it's a package require - we then need to figure out which package is needed, and in
  // particular the exact version for the given location on the dependency tree

  if (dependencyNameMatch) {
    const [, dependencyName, subPath] = dependencyNameMatch;

    const issuerLocator = findPackageLocatorSafe(issuer);
    const issuerInformation = getPackageInformationSafe(issuerLocator);

    // We obtain the dependency reference in regard to the package that request it

    let dependencyReference = issuerInformation.packageDependencies.get(dependencyName);

    // If we can't find it, we check if we can potentially load it from the top-level packages
    // it's a bit of a hack, but it improves compatibility with the existing Node ecosystem. Hopefully we should
    // eventually be able to kill it and become stricter once pnp gets enough traction

    if (dependencyReference === undefined) {
      const topLevelInformation = getPackageInformationSafe(topLevelLocator);
      dependencyReference = topLevelInformation.packageDependencies.get(dependencyName);
    }

    // If we can't find the path, and if the package making the request is the top-level, we can offer nicer error messages

    if (!dependencyReference) {
      if (dependencyReference === null) {
        if (issuerLocator === topLevelLocator) {
          throw new Error(
            `You seem to be requiring a peer dependency ("${dependencyName}"), but it is not installed (which might be because you're the top-level package)`,
          );
        } else {
          throw new Error(
            `Package "${issuerLocator.name}@${issuerLocator.reference}" is trying to access a peer dependency ("${dependencyName}") that should be provided by its direct ancestor but isn't`,
          );
        }
      } else {
        if (issuerLocator === topLevelLocator) {
          throw new Error(
            `You cannot require a package ("${dependencyName}") that is not declared in your dependencies`,
          );
        } else {
          throw new Error(
            `Package ${issuerLocator.name}@${issuerLocator.reference} is trying to require package ${dependencyName} (via "${request}") without it being listed in its dependencies (${Array.from(
              issuerInformation.packageDependencies.keys(),
            ).join(`, `)})`,
          );
        }
      }
    }

    // We need to check that the package exists on the filesystem, because it might not have been installed

    const dependencyLocator = {name: dependencyName, reference: dependencyReference};
    const dependencyInformation = exports.getPackageInformation(dependencyLocator);
    const dependencyLocation = dependencyInformation.packageLocation;

    if (!dependencyLocation) {
      throw new Error(
        `Package "${dependencyLocator.name}@${dependencyLocator.reference}" is a valid dependency, but hasn't been installed and thus cannot be required`,
      );
    }

    // Now that we know which package we should resolve to, we only have to find out the file location

    if (subPath) {
      filesystemPath = path.resolve(dependencyLocation, subPath); // slice(1) to strip the leading '/'
    } else if (dependencyInformation.packageMainEntry) {
      filesystemPath = path.resolve(dependencyLocation, dependencyInformation.packageMainEntry);
    } else {
      filesystemPath = dependencyLocation;
    }
  }

  // Try to resolve the filesystem according to the Node rules (directory -> index, optional .js extensions, etc)

  const qualifiedFilesystemPath = applyNodeExtensionResolution(filesystemPath);

  if (qualifiedFilesystemPath) {
    return path.normalize(qualifiedFilesystemPath);
  } else {
    throw new Error(`Couldn't find a suitable Node resolution for path "${filesystemPath}"`);
  }
};

/**
 * Setups the hook into the Node environment
 */

exports.setup = function setup() {
  function getIssuer(parent) {
    let issuer = parent;

    while (issuer && (issuer.id === '[eval]' || issuer.id === '<repl>' || !issuer.filename)) {
      issuer = issuer.parent;
    }

    return issuer;
  }

  Module._load = function(request, parent, isMain) {
    // Builtins are managed by the regular Node loader

    if (builtinModules.indexOf(request) !== -1) {
      return originalLoader.call(this, request, parent, isMain);
    }

    // We allow to shim modules, which is useful for packages such as `resolve`

    const shim = moduleShims.get(request);

    if (shim) {
      return shim;
    }

    // Request `Module._resolveFilename` (ie. `resolveRequest`) to tell us which file we should load

    const filesystemPath = Module._resolveFilename(request, parent, isMain);

    // Check if the module has already been created for the given file

    const cacheEntry = moduleCache.get(filesystemPath);

    if (cacheEntry) {
      return cacheEntry.exports;
    }

    // Create a new module and store it into the cache

    const module = new Module(filesystemPath, parent);
    moduleCache.set(filesystemPath, module);

    // The main module is exposed as global variable

    if (isMain) {
      process.mainModule = module;
      module.id = '.';
    }

    // Try to load the module, and remove it from the cache if it fails

    let hasThrown = true;

    try {
      module.load(filesystemPath);
      hasThrown = false;
    } finally {
      if (hasThrown) {
        moduleCache.delete(filesystemPath);
      }
    }

    return module.exports;
  };

  Module._resolveFilename = function(request, parent, isMain, options) {
    const issuerModule = getIssuer(parent);
    const issuer = issuerModule ? issuerModule.filename : process.cwd() + path.sep;

    return exports.resolveRequest(request, issuer);
  };
};

exports.setupCompatibilityLayer = () => {
  // see https://github.com/browserify/resolve/blob/master/lib/caller.js
  const getCaller = () => {
    const origPrepareStackTrace = Error.prepareStackTrace;

    Error.prepareStackTrace = (_, stack) => stack;
    const stack = new Error().stack;
    Error.prepareStackTrace = origPrepareStackTrace;

    return stack[2].getFileName();
  };

  const resolveSyncShim = (request, options = {}) => {
    let basedir = options.basedir || path.dirname(getCaller());
    basedir = basedir.replace(/[\\\/]?$/, path.sep);

    const resolution = exports.resolveRequest(request, basedir);

    if (resolution) {
      return resolution;
    } else {
      throw new Error(`Resolution failed for path "${request}"`);
    }
  };

  const resolveShim = (request, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    // We need to compute it here because otherwise resolveSyncShim will read the wrong stacktrace entry
    let basedir = options.basedir || path.dirname(getCaller());
    basedir = basedir.replace(/[\\\/]?$/, path.sep);

    setImmediate(() => {
      let error;
      let result;

      try {
        result = resolveShim.sync(request, Object.assign(options, {basedir}));
      } catch (thrown) {
        error = thrown;
      }

      callback(error, result);
    });
  };

  moduleShims.set('resolve', Object.assign(resolveShim, {sync: resolveSyncShim}));
};

if (module.parent && module.parent.id === 'internal/preload') {
  exports.setup();
  exports.setupCompatibilityLayer();
}
