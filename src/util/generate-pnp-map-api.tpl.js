/* eslint-disable max-len, flowtype/require-valid-file-annotation, flowtype/require-return-type */
/* global packageInformationStores, $$LOCKFILE_FOLDER */

const fs = require('fs');
const Module = require('module');
const path = require('path');

const builtinModules = Module.builtinModules || Object.keys(process.binding('natives'));

const originalLoader = Module._load;
const originalReadFile = fs.readFile;

const pathRegExp = /^(?!\.{0,2}(?:\/|$))((?:@[^\/]+\/)?[^\/]+)\/?(.*|)$/;

const topLevelLocator = {name: null, reference: null};
const topLevelResolution = {locator: topLevelLocator, treePath: ``, filesystemDirectory: $$LOCKFILE_FOLDER};

const pnpResolutionSymbol = Symbol('pnpResolution');

const moduleShims = new Map();
const moduleCache = new Map();

const pnpPathMagic = `/.//.//.//`;

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

function getPeerReferencesSafe(packageInformation, parentTreePath) {
  const peerReferences = packageInformation.packagePeers.get(parentTreePath);

  if (!peerReferences) {
    throw new Error(
      `Couldn't find the peer candidates for package located at "${parentTreePath}" in the dependency tree (this is probably an internal error)`,
    );
  }

  return peerReferences;
}

/**
 * Given a tree path (pkg-a/sub-pkg-b/foobar), returns the associated locator (foobar@1.0.0)
 */

function getLocatorFromTreePath(treePath) {
  const parts = treePath ? treePath.split(/\//g) : [];
  let currentLocator = topLevelLocator;

  for (let t = 0; t < parts.length; ++t) {
    const dependencies = exports.getPackageInformation(currentLocator);
    const currentTreePath = parts.slice(0, t).join('/');

    const dependencyName = parts[t];
    let dependencyReference = dependencies.packageDependencies.get(dependencyName);

    if (!dependencyReference && dependencies.packagePeers) {
      const peerReferences = dependencies.packagePeers.get(currentTreePath);

      if (peerReferences) {
        dependencyReference = peerReferences.get(dependencyName);
      }
    }

    if (!dependencyReference) {
      return null;
    }

    currentLocator = {name: dependencyName, reference: dependencyReference};
  }

  return currentLocator;
}

/**
 * Transforms the result of exports.resolveRequest into a single string.
 */

/* eslint-disable no-bitwise */
function serializeResolution(resolution) {
  let output = pnpPathMagic;

  writeShort(resolution.treePath.length);

  for (let t = 0; t < resolution.treePath.length; ++t) {
    writeByte(resolution.treePath.charCodeAt(t));
  }

  return output + resolution.filesystemPath;

  function writeShort(n) {
    writeByte((n >>> 0) & 0xff);
    writeByte((n >>> 8) & 0xff);
  }

  function writeByte(n) {
    output += n.toString(2).padStart(8, '0').replace(/0/g, `./`).replace(/1/g, `//`);
  }
}
/* eslint-enable no-bitwise */

/**
*/

/* eslint-disable no-bitwise */
function deserializeResolution(serializedResolution) {
  let offset = pnpPathMagic.length;

  const size = readShort();
  const charCodes = [];

  for (let t = 0; t < size; ++t) {
    charCodes.push(readByte());
  }

  const filesystemPath = serializedResolution.slice(offset);
  const filesystemDirectory = path.dirname(filesystemPath);
  const treePath = String.fromCharCode(...charCodes);

  const locator = getLocatorFromTreePath(treePath);
  const cacheKey = getCacheKey(filesystemPath, locator, treePath);

  return {locator, treePath, filesystemPath, filesystemDirectory, cacheKey};

  function readShort() {
    return readByte() | (readByte() << 8);
  }

  function readByte() {
    const encodedByte = serializedResolution.slice(offset, (offset += 2 * 8));
    let decodedByte = 0;

    for (let t = 0; t < 2 * 8; t += 2) {
      decodedByte *= 2;
      decodedByte += encodedByte.slice(t, t + 2).includes(`.`) ? 0 : 1;
    }

    return decodedByte;
  }
}
/* eslint-enable no-bitwise */

/**
 * Computes the cache key for the given file of the given package.
 *
 * The cache key is the file path for most entries, but if their owning package has peer dependency then we need to
 * bake the peer dependencies resolved references into the cache key (because we'll need to instanciate multiple
 * versions of the same file, one for each set of dependencies).
 */

function getCacheKey(filesystemPath, packageLocator, treePath) {
  let cacheKey = filesystemPath;

  const packageInformation = getPackageInformationSafe(packageLocator);

  if (packageInformation.packagePeers) {
    const peerReferences = getPeerReferencesSafe(packageInformation, treePath);

    for (const [dependencyName, dependencyReference] of peerReferences.entries()) {
      cacheKey += `@${dependencyName}@${dependencyReference}`;
    }
  }

  return cacheKey;
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

exports.resolveRequest = function resolveRequest(request, parentResolution) {
  // Bailout if the request is a native module

  if (builtinModules.indexOf(request) !== -1) {
    return null;
  }

  // If the request is a serialized resolution, we just have to deserialize it

  if (request.startsWith(pnpPathMagic)) {
    return deserializeResolution(request);
  }

  let dependencyLocator;

  let treePath;
  let filesystemPath;

  // If the request is a relative or absolute path, we just have to reuse the parent resolution, and resolve the
  // request path relative to the parent resolution own path

  const dependencyNameMatch = request.match(pathRegExp);

  if (!dependencyNameMatch) {
    dependencyLocator = parentResolution.locator;

    treePath = parentResolution.treePath;
    filesystemPath = path.resolve(parentResolution.filesystemDirectory, request);
  }

  // Things are more hairy if it's a package require - we then need to figure out which package is needed, and in
  // particular the exact version for the given location on the dependency tree

  if (dependencyNameMatch) {
    const [, dependencyName, subPath] = dependencyNameMatch;

    const packageInformation = getPackageInformationSafe(parentResolution.locator);

    // We obtain the dependency reference in regard to the package that request it

    let dependencyReference = packageInformation.packageDependencies.get(dependencyName);

    // If there's no strict dependency that match the request, we look into peer dependencies

    if (!dependencyReference && packageInformation.packagePeers) {
      const peerReferences = getPeerReferencesSafe(packageInformation, parentResolution.treePath);
      const peerReference = peerReferences.get(dependencyName);

      if (peerReference === null) {
        throw new Error(
          `Package "${parentResolution.locator.name}" tries to access a missing peer dependency ("${dependencyName}")`,
        );
      }

      dependencyReference = peerReference;
    }

    // If we STILL can't find it, we fallback to the top-level dependencies
    // This fallback isn't ideal, but makes working with plugins much easier

    if (!dependencyReference) {
      const topLevelInformation = exports.getPackageInformation(topLevelLocator);

      dependencyReference = topLevelInformation.packageDependencies.get(dependencyName);

      if (dependencyReference) {
        parentResolution = topLevelResolution;
      }
    }

    // And if we still haven't been able to resolve it, we give up
    // If the package making the request is the top-level, we can offer a nicer error message

    if (dependencyReference) {
      treePath = parentResolution.treePath ? `${parentResolution.treePath}/${dependencyName}` : dependencyName;
      dependencyLocator = {name: dependencyName, reference: dependencyReference};
    } else {
      if (parentResolution.locator !== topLevelLocator) {
        throw new Error(
          `Package ${parentResolution.locator.name}@${parentResolution.locator
            .reference} is trying to require package ${dependencyName} through "${request}", which is not declared in its dependencies (${Array.from(
            packageInformation.packageDependencies.keys(),
          ).join(`, `)})`,
        );
      } else {
        throw new Error(`You cannot require a package (${dependencyName}) that is not declared in your dependencies`);
      }
    }

    // We need to check that the package exists on the filesystem, because it might not have been installed

    const dependencyInformation = exports.getPackageInformation(dependencyLocator);
    const dependencyLocation = dependencyInformation.packageLocation;

    if (!dependencyLocation) {
      throw new Error(
        `Package ${dependencyLocator.name}@${dependencyLocator.reference} is a valid dependency, but hasn't been installed and thus cannot be required`,
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
    filesystemPath = qualifiedFilesystemPath;
  } else {
    throw new Error(
      `Couldn't find a suitable resolution for path "${filesystemPath}" (initial request was "${request}")`,
    );
  }

  // Compute the remaining fields

  const locator = dependencyLocator;
  const filesystemDirectory = path.dirname(filesystemPath);
  const cacheKey = getCacheKey(filesystemPath, locator, treePath);

  const resolution = {locator, treePath, filesystemPath, filesystemDirectory, cacheKey};

  return resolution;
};

/**
 * Setups the hook into the Node environment
 */

exports.setup = function setup(initialParentTreePath) {
  const initialParentLocator = getLocatorFromTreePath(initialParentTreePath);

  if (!initialParentLocator) {
    throw new Error(
      `Could not find resolve the given entry point, "${initialParentTreePath}" (this is probably an internal error)`,
    );
  }

  const initialResolution = {
    locator: initialParentLocator,
    treePath: initialParentTreePath,
    filesystemDirectory: process.cwd(),
  };

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

    const parentResolution = parent && parent[pnpResolutionSymbol] ? parent[pnpResolutionSymbol] : initialResolution;
    const requestResolution = exports.resolveRequest(request, parentResolution);

    // Check if the module has already been created

    const cacheEntry = moduleCache.get(requestResolution.cacheKey);

    if (cacheEntry) {
      return cacheEntry.exports;
    }

    // Create a new module and store it into the cache

    const module = new Module(requestResolution.filesystemPath, parent);
    module[pnpResolutionSymbol] = requestResolution;

    moduleCache.set(requestResolution.cacheKey, module);

    // Main modules are exposed on the global instances

    if (isMain) {
      process.mainModule = module;
      module.id = '.';
    }

    // Try to load the module, and remove it from the cache if it fails

    let hasThrown = true;

    try {
      module.load(requestResolution.filesystemPath);
      hasThrown = false;
    } finally {
      if (hasThrown) {
        moduleCache.delete(requestResolution.cacheKey);
      }
    }

    return module.exports;
  };

  Module._resolveFilename = function(request, parent, isMain, options) {
    if (builtinModules.indexOf(request) !== -1) {
      return request;
    }

    const parentResolution = parent && parent[pnpResolutionSymbol] ? parent[pnpResolutionSymbol] : initialResolution;
    const resolution = exports.resolveRequest(request, parentResolution);

    return serializeResolution(resolution);
  };

  fs.readFile = (target, ...args) => {
    return originalReadFile.call(fs, path.normalize(target), ...args);
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
    const basedir = options.basedir || path.dirname(getCaller());
    let parentResolution;

    if (basedir === $$LOCKFILE_FOLDER || basedir.startsWith($$LOCKFILE_FOLDER + `/`)) {
      parentResolution = topLevelResolution;
    } else if (basedir.startsWith(pnpPathMagic)) {
      parentResolution = deserializeResolution(basedir);

      // HACK: since basedir is traditionally a folder, the filesystemDirectory actually is filesystemPath!
      // If we don't make this change, parentResolution.filesystemDirectory will be dirname(dirname(X)): the first one
      // because the user did it themselves, and the second one because deserializeResolution thought that the string
      // would contain something it returned in the past (which always is a file), so it would compute the directory by
      // using dirname() on this path.
      parentResolution.filesystemDirectory = parentResolution.filesystemPath;
    } else {
      throw new Error(
        `This usage of the "resolve" module is not supported on Plug'n'Play environments (got "${options.basedir}" as basedir)`,
      );
    }

    const resolution = exports.resolveRequest(request, parentResolution);

    if (resolution) {
      return serializeResolution(resolution);
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
    const basedir = options.basedir || path.dirname(getCaller());

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
  exports.setup(process.env.YARN_PNP_PATH || '');
  exports.setupCompatibilityLayer();
}
