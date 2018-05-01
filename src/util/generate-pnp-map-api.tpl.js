#!/usr/bin/env node

/* eslint-disable max-len, flowtype/require-valid-file-annotation, flowtype/require-return-type */
/* global packageInformationStores, $$SETUP_STATIC_TABLES */

const fs = require('fs');
const Module = require('module');
const path = require('path');
const StringDecoder = require('string_decoder');

const builtinModules = Module.builtinModules || Object.keys(process.binding('natives'));

const originalLoader = Module._load;
const originalFindPath = Module._findPath;
const originalNodeModulePaths = Module._nodeModulePaths;

const pathRegExp = /^(?!\.{0,2}(?:\/|$))((?:@[^\/]+\/)?[^\/]+)\/?(.*|)$/;
const isDirRegExp = /[\\\/]$/;

const topLevelLocator = {name: null, reference: null};
const blacklistedLocator = {name: NaN, reference: NaN};

const moduleShims = new Map();
const moduleCache = new Map();

/**
 * Ensures that the returned locator isn't a blacklisted one.
 *
 * Blacklisted packages are packages that cannot be used because their dependencies cannot be deduced. This only
 * happens with peer dependencies, which effectively have different sets of dependencies depending on their parents.
 *
 * In order to deambiguate those different sets of dependencies, the Yarn implementation of PnP will generate a
 * symlink for each combination of <package name>/<package version>/<dependent package> it will find, and will
 * blacklist the target of those symlinks. By doing this, we ensure that files loaded through a specific path
 * will always have the same set of dependencies, provided the symlinks are correctly preserved.
 *
 * Unfortunately, some tools do not preserve them, and when it happens PnP isn't able anymore to deduce the set of
 * dependencies based on the path of the file that makes the require calls. But since we've blacklisted those paths,
 * we're able to print a more helpful error message that points out that a third-party package is doing something
 * incompatible!
 */

// eslint-disable-next-line no-unused-vars
function blacklistCheck(locator) {
  if (locator === blacklistedLocator) {
    throw new Error(
      [
        `A package has been resolved through a blacklisted path - this is usually caused by one of your tool calling`,
        `"realpath" on the return value of "require.resolve". Since the returned values use symlinks to disambiguate`,
        `peer dependencies, they must be passed untransformed to "require".`,
      ].join(` `),
    );
  }

  return locator;
}

$$SETUP_STATIC_TABLES();

/**
 * Returns the module that should be used to resolve require calls. It's usually the direct parent, except if we're
 * inside an eval expression.
 */

function getIssuerModule(parent) {
  let issuer = parent;

  while (issuer && (issuer.id === '[eval]' || issuer.id === '<repl>' || !issuer.filename)) {
    issuer = issuer.parent;
  }

  return issuer;
}

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
 * Implements the node resolution for folder access and extension selection
 */

function applyNodeExtensionResolution(filesystemPath) {
  // We use this "infinite while" so that we can restart the process as long as we hit package folders
  while (true) {
    let stat;

    try {
      stat = fs.statSync(filesystemPath);
    } catch (error) {}

    // If the file exists and is a file, we can stop right there

    if (stat && !stat.isDirectory()) {
      return filesystemPath;
    }

    // If the file is a directory, we must check if it contains a package.json with a "main" entry

    if (stat && stat.isDirectory()) {
      let pkgJson;

      try {
        pkgJson = JSON.parse(fs.readFileSync(`${filesystemPath}/package.json`, 'utf-8'));
      } catch (error) {}

      let nextFilesystemPath;

      if (pkgJson && pkgJson.main) {
        nextFilesystemPath = path.resolve(filesystemPath, pkgJson.main);
      }

      // If the "main" field changed the path, we start again from this new location

      if (nextFilesystemPath && nextFilesystemPath !== filesystemPath) {
        filesystemPath = nextFilesystemPath;
        continue;
      }
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
}

/**
 * Forward the resolution to the next resolver (usually the native one)
 */

function callNativeResolution(request, issuer) {
  if (issuer.endsWith('/')) {
    issuer += 'internal.js';
  }

  const paths = originalNodeModulePaths.call(Module, issuer);
  const result = originalFindPath.call(Module, request, paths, false);

  return result;
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
 *
 * Note that it is extremely important that the `issuer` path ends with a forward slash if the issuer is to be
 * treated as a folder (ie. "/tmp/foo/" rather than "/tmp/foo" if "foo" is a directory). Otherwise relative
 * imports won't be computed correctly (they'll get resolved relative to "/tmp/" instead of "/tmp/foo/").
 */

exports.resolveRequest = function resolveRequest(request, issuer) {
  // Bailout if the request is a native module

  if (builtinModules.indexOf(request) !== -1) {
    return request;
  }

  let filesystemPath;

  // If the request is a relative or absolute path, we just return it normalized
  //
  // Note that if the very last component of the issuer is a symlink to a file, we then need to resolve it, but
  // only it, and not the rest of the path! This allows us to support the case of bin symlinks, where a symlink
  // in "/.../pkg-name/.bin/bin-name" will point somewhere else (like "/../pkg-name/index.js"). In such a case,
  // we want relative requires to be resolved relative to "/../pkg-name/" rather than "/../pkg-name/.bin/".
  //
  // Also note that the reason we must use readlink on the last component (instead of realpath on the whole path)
  // is that we must preserve the other symlinks, in particular those used by pnp to deambiguate packages using
  // peer dependencies. For example, "/../.pnp/local/pnp-01234569/.bin/bin-name" should see its relative requires
  // be resolved relative to "/../.pnp/local/pnp-0123456789/" rather than "/../pkg-with-peers/", because otherwise
  // we would lose the information that would tell us what are the dependencies of pkg-with-peers relative to its
  // ancestors.

  const dependencyNameMatch = request.match(pathRegExp);

  if (!dependencyNameMatch) {
    if (issuer.match(isDirRegExp)) {
      filesystemPath = path.normalize(path.resolve(issuer, request));
    } else if (fs.lstatSync(issuer).isSymbolicLink()) {
      filesystemPath = path.normalize(path.resolve(path.dirname(issuer), path.dirname(fs.readlinkSync(issuer)), request));
    } else {
      filesystemPath = path.normalize(path.resolve(path.dirname(issuer), request));
    }
  }

  // Things are more hairy if it's a package require - we then need to figure out which package is needed, and in
  // particular the exact version for the given location on the dependency tree

  if (dependencyNameMatch) {
    const [, dependencyName, subPath] = dependencyNameMatch;

    const issuerLocator = exports.findPackageLocator(issuer);

    // If the issuer file doesn't seem to be owned by a package managed through pnp, then we resort to using the next
    // resolution algorithm in the chain, usually the native Node resolution one

    if (!issuerLocator) {
      return callNativeResolution(request, issuer);
    }

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
    const issuerModule = getIssuerModule(parent);
    const issuer = issuerModule ? issuerModule.filename : process.cwd() + path.sep;

    return exports.resolveRequest(request, issuer);
  };

  Module._findPath = function(request, paths, isMain) {
    for (const path of paths) {
      let resolution;

      try {
        resolution = exports.resolveRequest(request, path);
      } catch (error) {
        continue;
      }

      if (resolution) {
        return resolution;
      }
    }

    return false;
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
  const issuerPath = process.argv[1] || process.cwd() + path.sep;
  const issuerLocator = exports.findPackageLocator(issuerPath);

  exports.setup();
  exports.setupCompatibilityLayer();
}

if (process.mainModule === module) {
  let buffer = '';
  const decoder = new StringDecoder.StringDecoder();

  process.stdin.on('data', chunk => {
    buffer += decoder.write(chunk);

    do {
      const index = buffer.indexOf('\n');
      if (index === -1) {
        break;
      }

      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);

      try {
        const data = JSON.parse(line);
        process.stdout.write(`${exports.resolveRequest(data[0], data[1])}\n`);
      } catch (error) {
        process.stdout.write(`${error.message}\n`);
      }
    } while (true);
  });
}
