'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generatePnpMap = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let getPackageInformationStores = (() => {
  var _ref17 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, seedPatterns, { resolver, reporter, targetPath, workspaceLayout }) {
    const targetDirectory = path.dirname(targetPath);
    const offlineCacheFolder = config.offlineCacheFolder;

    const packageInformationStores = new Map();
    const blacklistedLocations = new Set();

    const getCachePath = function getCachePath(fsPath) {
      const cacheRelativePath = normalizePath(path.relative(config.cacheFolder, fsPath));

      // if fsPath is not inside cacheRelativePath, we just skip it
      if (cacheRelativePath.match(/^\.\.\//)) {
        return null;
      }

      return cacheRelativePath;
    };

    const resolveOfflineCacheFolder = function resolveOfflineCacheFolder(fsPath) {
      if (!offlineCacheFolder) {
        return fsPath;
      }

      const cacheRelativePath = getCachePath(fsPath);

      // if fsPath is not inside the cache, we shouldn't replace it (workspace)
      if (!cacheRelativePath) {
        return fsPath;
      }

      const components = cacheRelativePath.split(/\//g);
      const cacheEntry = components[0],
            internalPath = components.slice(1);


      return path.resolve(offlineCacheFolder, `${cacheEntry}${OFFLINE_CACHE_EXTENSION}`, internalPath.join('/'));
    };

    const normalizePath = function normalizePath(fsPath) {
      return process.platform === 'win32' ? fsPath.replace(backwardSlashRegExp, '/') : fsPath;
    };

    const normalizeDirectoryPath = function normalizeDirectoryPath(fsPath) {
      let relativePath = normalizePath(path.relative(targetDirectory, resolveOfflineCacheFolder(fsPath)));

      if (!relativePath.match(/^\.{0,2}\//) && !path.isAbsolute(relativePath)) {
        relativePath = `./${relativePath}`;
      }

      return relativePath.replace(/\/?$/, '/');
    };

    const getHashFrom = function getHashFrom(data) {
      const hashGenerator = crypto.createHash('sha1');

      for (var _iterator10 = data, _isArray10 = Array.isArray(_iterator10), _i10 = 0, _iterator10 = _isArray10 ? _iterator10 : _iterator10[Symbol.iterator]();;) {
        var _ref18;

        if (_isArray10) {
          if (_i10 >= _iterator10.length) break;
          _ref18 = _iterator10[_i10++];
        } else {
          _i10 = _iterator10.next();
          if (_i10.done) break;
          _ref18 = _i10.value;
        }

        const datum = _ref18;

        hashGenerator.update(datum);
      }

      return hashGenerator.digest('hex');
    };

    const getResolverEntry = function getResolverEntry(pattern) {
      const pkg = resolver.getStrictResolvedPattern(pattern);
      const ref = pkg._reference;

      if (!ref) {
        return null;
      }

      invariant(ref.locations.length <= 1, 'Must have at most one location (usually in the cache)');
      const loc = ref.locations[0];

      if (!loc) {
        return null;
      }

      return { pkg, ref, loc };
    };

    const visit = (() => {
      var _ref19 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (precomputedResolutions, seedPatterns, parentData = []) {
        const resolutions = new Map(precomputedResolutions);
        const locations = new Map();

        // This first pass will compute the package reference of each of the given patterns
        // They will usually be the package version, but not always. We need to do this in a pre-process pass, because the
        // dependencies might depend on one another, so if we need to replace one of them, we need to compute it first
        for (var _iterator11 = seedPatterns, _isArray11 = Array.isArray(_iterator11), _i11 = 0, _iterator11 = _isArray11 ? _iterator11 : _iterator11[Symbol.iterator]();;) {
          var _ref20;

          if (_isArray11) {
            if (_i11 >= _iterator11.length) break;
            _ref20 = _iterator11[_i11++];
          } else {
            _i11 = _iterator11.next();
            if (_i11.done) break;
            _ref20 = _i11.value;
          }

          const pattern = _ref20;

          const entry = getResolverEntry(pattern);

          if (!entry) {
            continue;
          }

          const pkg = entry.pkg,
                ref = entry.ref;
          let loc = entry.loc;


          const packageName = pkg.name;
          let packageReference = pkg.version;

          // If we have peer dependencies, then we generate a new virtual reference based on the parent one
          // We cannot generate this reference based on what those peer references resolve to, because they might not have
          // been computed yet (for example, consider the case where A has a peer dependency on B, and B a peer dependency
          // on A; it's valid, but it prevents us from computing A and B - and it's even worse with 3+ packages involved)
          const peerDependencies = new Set(Array.from(Object.keys(pkg.peerDependencies || {})));

          // As an optimization, we only setup virtual packages if their underlying packages are referenced multiple times
          // in the tree. This allow us to avoid having to create symlinks in the majority of cases
          if (peerDependencies.size > 0 && ref.requests.length > 1) {
            const hash = getHashFrom([...parentData, packageName, packageReference]);

            let symlinkSource;
            let symlinkFile;

            switch (ref.remote.type) {
              case 'workspace':
                {
                  symlinkSource = loc;
                  symlinkFile = path.resolve(config.lockfileFolder, '.pnp', 'workspaces', `pnp-${hash}`, packageName);

                  loc = symlinkFile;
                }
                break;

              default:
                {
                  const isFromCache = getCachePath(loc);

                  const hashName = isFromCache && offlineCacheFolder ? `pnp-${hash}${OFFLINE_CACHE_EXTENSION}` : `pnp-${hash}`;
                  const newLoc = path.resolve(config.lockfileFolder, '.pnp', 'externals', hashName, 'node_modules', packageName);

                  // The `node_modules/<pkgName>` part is already there when the package comes from the cache
                  if (isFromCache) {
                    const getBase = function getBase(source) {
                      return path.resolve(source, '../'.repeat(1 + packageName.split('/').length));
                    };
                    symlinkSource = resolveOfflineCacheFolder(getBase(loc));
                    symlinkFile = getBase(newLoc);
                  } else {
                    symlinkSource = loc;
                    symlinkFile = newLoc;
                  }

                  loc = newLoc;
                }
                break;
            }

            yield (_fs || _load_fs()).mkdirp(path.dirname(symlinkFile));
            yield (_fs || _load_fs()).symlink(symlinkSource, symlinkFile);

            packageReference = `pnp:${hash}`;

            // We blacklist this path so that we can print a nicer error message if someone tries to require it (it usually
            // means that they're using realpath on the return value of require.resolve)
            blacklistedLocations.add(normalizeDirectoryPath(loc));
          }

          // Now that we have the final reference, we need to store it
          resolutions.set(packageName, packageReference);
          locations.set(packageName, loc);
        }

        // Now that we have the final references, we can start the main loop, which will insert the packages into the store
        // if they aren't already there, and recurse over their own children
        for (var _iterator12 = seedPatterns, _isArray12 = Array.isArray(_iterator12), _i12 = 0, _iterator12 = _isArray12 ? _iterator12 : _iterator12[Symbol.iterator]();;) {
          var _ref21;

          if (_isArray12) {
            if (_i12 >= _iterator12.length) break;
            _ref21 = _iterator12[_i12++];
          } else {
            _i12 = _iterator12.next();
            if (_i12.done) break;
            _ref21 = _i12.value;
          }

          const pattern = _ref21;

          const entry = getResolverEntry(pattern);

          if (!entry) {
            continue;
          }

          const pkg = entry.pkg,
                ref = entry.ref;


          const packageName = pkg.name;

          const packageReference = resolutions.get(packageName);
          invariant(packageReference, `Package reference should have been computed during the pre-pass`);

          const loc = locations.get(packageName);
          invariant(loc, `Package location should have been computed during the pre-pass`);

          // We can early exit if the package is already registered with the exact same name and reference, since even if
          // we might get slightly different dependencies (depending on how things were optimized), both sets are valid
          let packageInformationStore = packageInformationStores.get(packageName);

          if (!packageInformationStore) {
            packageInformationStore = new Map();
            packageInformationStores.set(packageName, packageInformationStore);
          }

          let packageInformation = packageInformationStore.get(packageReference);

          if (packageInformation) {
            continue;
          }

          packageInformation = {
            packageLocation: normalizeDirectoryPath(loc),
            packageDependencies: new Map()
          };

          // Split the dependencies between direct/peer - we will only recurse on the former
          const peerDependencies = new Set(Array.from(Object.keys(pkg.peerDependencies || {})));
          const directDependencies = ref.dependencies.filter(function (pattern) {
            const pkg = resolver.getStrictResolvedPattern(pattern);
            return !pkg || !peerDependencies.has(pkg.name);
          });

          // We inject the partial information in the store right now so that we won't cycle indefinitely
          packageInformationStore.set(packageReference, packageInformation);

          // We must inject the peer dependencies before iterating; one of our dependencies might have a peer dependency
          // on one of our peer dependencies, so it must be available from the start (we don't have to do that for direct
          // dependencies, because the "visit" function that will iterate over them will automatically add the to the
          // candidate resolutions as part of the first step, cf above)

          for (var _iterator13 = peerDependencies, _isArray13 = Array.isArray(_iterator13), _i13 = 0, _iterator13 = _isArray13 ? _iterator13 : _iterator13[Symbol.iterator]();;) {
            var _ref22;

            if (_isArray13) {
              if (_i13 >= _iterator13.length) break;
              _ref22 = _iterator13[_i13++];
            } else {
              _i13 = _iterator13.next();
              if (_i13.done) break;
              _ref22 = _i13.value;
            }

            const dependencyName = _ref22;

            const dependencyReference = resolutions.get(dependencyName);

            if (dependencyReference) {
              packageInformation.packageDependencies.set(dependencyName, dependencyReference);
            }
          }

          const childResolutions = yield visit(packageInformation.packageDependencies, directDependencies, [packageName, packageReference]);

          // We can now inject into our package the resolutions we got from the visit function
          for (var _iterator14 = childResolutions.entries(), _isArray14 = Array.isArray(_iterator14), _i14 = 0, _iterator14 = _isArray14 ? _iterator14 : _iterator14[Symbol.iterator]();;) {
            var _ref24;

            if (_isArray14) {
              if (_i14 >= _iterator14.length) break;
              _ref24 = _iterator14[_i14++];
            } else {
              _i14 = _iterator14.next();
              if (_i14.done) break;
              _ref24 = _i14.value;
            }

            const _ref23 = _ref24;
            const name = _ref23[0];
            const reference = _ref23[1];

            packageInformation.packageDependencies.set(name, reference);
          }

          // Finally, unless a package depends on a previous version of itself (that would be weird but correct...), we
          // inject them an implicit dependency to themselves (so that they can require themselves)
          if (!packageInformation.packageDependencies.has(packageName)) {
            packageInformation.packageDependencies.set(packageName, packageReference);
          }
        }

        return resolutions;
      });

      return function visit(_x4, _x5) {
        return _ref19.apply(this, arguments);
      };
    })();

    // If we have workspaces, we need to iterate over them all in order to add them to the map
    // This is because they might not be declared as dependencies of the top-level project (and with reason, since the
    // top-level package might depend on a different than the one provided in the workspaces - cf Babel, which depends
    // on an old version of itself in order to compile itself)
    if (workspaceLayout) {
      for (var _iterator15 = Object.keys(workspaceLayout.workspaces), _isArray15 = Array.isArray(_iterator15), _i15 = 0, _iterator15 = _isArray15 ? _iterator15 : _iterator15[Symbol.iterator]();;) {
        var _ref25;

        if (_isArray15) {
          if (_i15 >= _iterator15.length) break;
          _ref25 = _iterator15[_i15++];
        } else {
          _i15 = _iterator15.next();
          if (_i15.done) break;
          _ref25 = _i15.value;
        }

        const name = _ref25;

        const pkg = workspaceLayout.workspaces[name].manifest;

        // Skip the aggregator, since it's essentially a duplicate of the top-level package that we'll iterate later on
        if (pkg.workspaces) {
          continue;
        }

        const ref = pkg._reference;
        invariant(ref, `Workspaces should have a reference`);

        invariant(ref.locations.length === 1, `Workspaces should have exactly one location`);
        const loc = ref.locations[0];
        invariant(loc, `Workspaces should have a location`);

        let packageInformationStore = packageInformationStores.get(name);

        if (!packageInformationStore) {
          packageInformationStore = new Map();
          packageInformationStores.set(name, packageInformationStore);
        }

        packageInformationStore.set(pkg.version, {
          packageLocation: normalizeDirectoryPath(loc),
          packageDependencies: yield visit(new Map(), ref.dependencies, [name, pkg.version])
        });
      }
    }

    // Register the top-level package in our map
    // This will recurse on each of its dependencies as well.
    packageInformationStores.set(null, new Map([[null, {
      packageLocation: normalizeDirectoryPath(config.lockfileFolder),
      packageDependencies: yield visit(new Map(), seedPatterns)
    }]]));

    return [packageInformationStores, blacklistedLocations];
  });

  return function getPackageInformationStores(_x, _x2, _x3) {
    return _ref17.apply(this, arguments);
  };
})();

let generatePnpMap = exports.generatePnpMap = (() => {
  var _ref26 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, seedPatterns, { resolver, reporter, workspaceLayout, targetPath }) {
    var _ref27 = yield getPackageInformationStores(config, seedPatterns, {
      resolver,
      reporter,
      targetPath,
      workspaceLayout
    });

    const packageInformationStores = _ref27[0],
          blacklistedLocations = _ref27[1];


    const setupStaticTables = [generateMaps(packageInformationStores, blacklistedLocations), generateFindPackageLocator(packageInformationStores)].join(``);

    return pnpApi.replace(/\$\$SHEBANG/g, config.plugnplayShebang).replace(/\$\$BLACKLIST/g, JSON.stringify(config.plugnplayBlacklist)).replace(/\$\$SETUP_STATIC_TABLES\(\);/g, setupStaticTables);
  });

  return function generatePnpMap(_x6, _x7, _x8) {
    return _ref26.apply(this, arguments);
  };
})();

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('./fs.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* babel-plugin-inline-import './generate-pnp-map-api.tpl.js' */const pnpApi = '#!$$SHEBANG\n\n/* eslint-disable max-len, flowtype/require-valid-file-annotation, flowtype/require-return-type */\n/* global packageInformationStores, $$BLACKLIST, $$SETUP_STATIC_TABLES */\n\n// Used for the resolveUnqualified part of the resolution (ie resolving folder/index.js & file extensions)\n// Deconstructed so that they aren\'t affected by any fs monkeypatching occuring later during the execution\nconst {statSync, lstatSync, readlinkSync, readFileSync, existsSync, realpathSync} = require(\'fs\');\n\nconst Module = require(\'module\');\nconst path = require(\'path\');\nconst StringDecoder = require(\'string_decoder\');\n\nconst ignorePattern = $$BLACKLIST ? new RegExp($$BLACKLIST) : null;\n\nconst pnpFile = path.resolve(__dirname, __filename);\nconst builtinModules = new Set(Module.builtinModules || Object.keys(process.binding(\'natives\')));\n\nconst topLevelLocator = {name: null, reference: null};\nconst blacklistedLocator = {name: NaN, reference: NaN};\n\n// Used for compatibility purposes - cf setupCompatibilityLayer\nconst patchedModules = [];\nconst fallbackLocators = [topLevelLocator];\n\n// Matches backslashes of Windows paths\nconst backwardSlashRegExp = /\\\\/g;\n\n// Matches if the path must point to a directory (ie ends with /)\nconst isDirRegExp = /\\/$/;\n\n// Matches if the path starts with a valid path qualifier (./, ../, /)\n// eslint-disable-next-line no-unused-vars\nconst isStrictRegExp = /^\\.{0,2}\\//;\n\n// Splits a require request into its components, or return null if the request is a file path\nconst pathRegExp = /^(?![a-zA-Z]:[\\\\\\/]|\\\\\\\\|\\.{0,2}(?:\\/|$))((?:@[^\\/]+\\/)?[^\\/]+)\\/?(.*|)$/;\n\n// Keep a reference around ("module" is a common name in this context, so better rename it to something more significant)\nconst pnpModule = module;\n\n/**\n * Used to disable the resolution hooks (for when we want to fallback to the previous resolution - we then need\n * a way to "reset" the environment temporarily)\n */\n\nlet enableNativeHooks = true;\n\n/**\n * Simple helper function that assign an error code to an error, so that it can more easily be caught and used\n * by third-parties.\n */\n\nfunction makeError(code, message, data = {}) {\n  const error = new Error(message);\n  return Object.assign(error, {code, data});\n}\n\n/**\n * Ensures that the returned locator isn\'t a blacklisted one.\n *\n * Blacklisted packages are packages that cannot be used because their dependencies cannot be deduced. This only\n * happens with peer dependencies, which effectively have different sets of dependencies depending on their parents.\n *\n * In order to deambiguate those different sets of dependencies, the Yarn implementation of PnP will generate a\n * symlink for each combination of <package name>/<package version>/<dependent package> it will find, and will\n * blacklist the target of those symlinks. By doing this, we ensure that files loaded through a specific path\n * will always have the same set of dependencies, provided the symlinks are correctly preserved.\n *\n * Unfortunately, some tools do not preserve them, and when it happens PnP isn\'t able anymore to deduce the set of\n * dependencies based on the path of the file that makes the require calls. But since we\'ve blacklisted those paths,\n * we\'re able to print a more helpful error message that points out that a third-party package is doing something\n * incompatible!\n */\n\n// eslint-disable-next-line no-unused-vars\nfunction blacklistCheck(locator) {\n  if (locator === blacklistedLocator) {\n    throw makeError(\n      `BLACKLISTED`,\n      [\n        `A package has been resolved through a blacklisted path - this is usually caused by one of your tools calling`,\n        `"realpath" on the return value of "require.resolve". Since the returned values use symlinks to disambiguate`,\n        `peer dependencies, they must be passed untransformed to "require".`,\n      ].join(` `)\n    );\n  }\n\n  return locator;\n}\n\n$$SETUP_STATIC_TABLES();\n\n/**\n * Returns the module that should be used to resolve require calls. It\'s usually the direct parent, except if we\'re\n * inside an eval expression.\n */\n\nfunction getIssuerModule(parent) {\n  let issuer = parent;\n\n  while (issuer && (issuer.id === \'[eval]\' || issuer.id === \'<repl>\' || !issuer.filename)) {\n    issuer = issuer.parent;\n  }\n\n  return issuer;\n}\n\n/**\n * Returns information about a package in a safe way (will throw if they cannot be retrieved)\n */\n\nfunction getPackageInformationSafe(packageLocator) {\n  const packageInformation = exports.getPackageInformation(packageLocator);\n\n  if (!packageInformation) {\n    throw makeError(\n      `INTERNAL`,\n      `Couldn\'t find a matching entry in the dependency tree for the specified parent (this is probably an internal error)`\n    );\n  }\n\n  return packageInformation;\n}\n\n/**\n * Implements the node resolution for folder access and extension selection\n */\n\nfunction applyNodeExtensionResolution(unqualifiedPath, {extensions}) {\n  // We use this "infinite while" so that we can restart the process as long as we hit package folders\n  while (true) {\n    let stat;\n\n    try {\n      stat = statSync(unqualifiedPath);\n    } catch (error) {}\n\n    // If the file exists and is a file, we can stop right there\n\n    if (stat && !stat.isDirectory()) {\n      // If the very last component of the resolved path is a symlink to a file, we then resolve it to a file. We only\n      // do this first the last component, and not the rest of the path! This allows us to support the case of bin\n      // symlinks, where a symlink in "/xyz/pkg-name/.bin/bin-name" will point somewhere else (like "/xyz/pkg-name/index.js").\n      // In such a case, we want relative requires to be resolved relative to "/xyz/pkg-name/" rather than "/xyz/pkg-name/.bin/".\n      //\n      // Also note that the reason we must use readlink on the last component (instead of realpath on the whole path)\n      // is that we must preserve the other symlinks, in particular those used by pnp to deambiguate packages using\n      // peer dependencies. For example, "/xyz/.pnp/local/pnp-01234569/.bin/bin-name" should see its relative requires\n      // be resolved relative to "/xyz/.pnp/local/pnp-0123456789/" rather than "/xyz/pkg-with-peers/", because otherwise\n      // we would lose the information that would tell us what are the dependencies of pkg-with-peers relative to its\n      // ancestors.\n\n      if (lstatSync(unqualifiedPath).isSymbolicLink()) {\n        unqualifiedPath = path.normalize(path.resolve(path.dirname(unqualifiedPath), readlinkSync(unqualifiedPath)));\n      }\n\n      return unqualifiedPath;\n    }\n\n    // If the file is a directory, we must check if it contains a package.json with a "main" entry\n\n    if (stat && stat.isDirectory()) {\n      let pkgJson;\n\n      try {\n        pkgJson = JSON.parse(readFileSync(`${unqualifiedPath}/package.json`, \'utf-8\'));\n      } catch (error) {}\n\n      let nextUnqualifiedPath;\n\n      if (pkgJson && pkgJson.main) {\n        nextUnqualifiedPath = path.resolve(unqualifiedPath, pkgJson.main);\n      }\n\n      // If the "main" field changed the path, we start again from this new location\n\n      if (nextUnqualifiedPath && nextUnqualifiedPath !== unqualifiedPath) {\n        const resolution = applyNodeExtensionResolution(nextUnqualifiedPath, {extensions});\n\n        if (resolution !== null) {\n          return resolution;\n        }\n      }\n    }\n\n    // Otherwise we check if we find a file that match one of the supported extensions\n\n    const qualifiedPath = extensions\n      .map(extension => {\n        return `${unqualifiedPath}${extension}`;\n      })\n      .find(candidateFile => {\n        return existsSync(candidateFile);\n      });\n\n    if (qualifiedPath) {\n      return qualifiedPath;\n    }\n\n    // Otherwise, we check if the path is a folder - in such a case, we try to use its index\n\n    if (stat && stat.isDirectory()) {\n      const indexPath = extensions\n        .map(extension => {\n          return `${unqualifiedPath}/index${extension}`;\n        })\n        .find(candidateFile => {\n          return existsSync(candidateFile);\n        });\n\n      if (indexPath) {\n        return indexPath;\n      }\n    }\n\n    // Otherwise there\'s nothing else we can do :(\n\n    return null;\n  }\n}\n\n/**\n * This function creates fake modules that can be used with the _resolveFilename function.\n * Ideally it would be nice to be able to avoid this, since it causes useless allocations\n * and cannot be cached efficiently (we recompute the nodeModulePaths every time).\n *\n * Fortunately, this should only affect the fallback, and there hopefully shouldn\'t be a\n * lot of them.\n */\n\nfunction makeFakeModule(path) {\n  const fakeModule = new Module(path, false);\n  fakeModule.filename = path;\n  fakeModule.paths = Module._nodeModulePaths(path);\n  return fakeModule;\n}\n\n/**\n * Normalize path to posix format.\n */\n\nfunction normalizePath(fsPath) {\n  fsPath = path.normalize(fsPath);\n\n  if (process.platform === \'win32\') {\n    fsPath = fsPath.replace(backwardSlashRegExp, \'/\');\n  }\n\n  return fsPath;\n}\n\n/**\n * Forward the resolution to the next resolver (usually the native one)\n */\n\nfunction callNativeResolution(request, issuer) {\n  if (issuer.endsWith(\'/\')) {\n    issuer += \'internal.js\';\n  }\n\n  try {\n    enableNativeHooks = false;\n\n    // Since we would need to create a fake module anyway (to call _resolveLookupPath that\n    // would give us the paths to give to _resolveFilename), we can as well not use\n    // the {paths} option at all, since it internally makes _resolveFilename create another\n    // fake module anyway.\n    return Module._resolveFilename(request, makeFakeModule(issuer), false);\n  } finally {\n    enableNativeHooks = true;\n  }\n}\n\n/**\n * This key indicates which version of the standard is implemented by this resolver. The `std` key is the\n * Plug\'n\'Play standard, and any other key are third-party extensions. Third-party extensions are not allowed\n * to override the standard, and can only offer new methods.\n *\n * If an new version of the Plug\'n\'Play standard is released and some extensions conflict with newly added\n * functions, they\'ll just have to fix the conflicts and bump their own version number.\n */\n\nexports.VERSIONS = {std: 1};\n\n/**\n * Useful when used together with getPackageInformation to fetch information about the top-level package.\n */\n\nexports.topLevel = {name: null, reference: null};\n\n/**\n * Gets the package information for a given locator. Returns null if they cannot be retrieved.\n */\n\nexports.getPackageInformation = function getPackageInformation({name, reference}) {\n  const packageInformationStore = packageInformationStores.get(name);\n\n  if (!packageInformationStore) {\n    return null;\n  }\n\n  const packageInformation = packageInformationStore.get(reference);\n\n  if (!packageInformation) {\n    return null;\n  }\n\n  return packageInformation;\n};\n\n/**\n * Transforms a request (what\'s typically passed as argument to the require function) into an unqualified path.\n * This path is called "unqualified" because it only changes the package name to the package location on the disk,\n * which means that the end result still cannot be directly accessed (for example, it doesn\'t try to resolve the\n * file extension, or to resolve directories to their "index.js" content). Use the "resolveUnqualified" function\n * to convert them to fully-qualified paths, or just use "resolveRequest" that do both operations in one go.\n *\n * Note that it is extremely important that the `issuer` path ends with a forward slash if the issuer is to be\n * treated as a folder (ie. "/tmp/foo/" rather than "/tmp/foo" if "foo" is a directory). Otherwise relative\n * imports won\'t be computed correctly (they\'ll get resolved relative to "/tmp/" instead of "/tmp/foo/").\n */\n\nexports.resolveToUnqualified = function resolveToUnqualified(request, issuer, {considerBuiltins = true} = {}) {\n  // The \'pnpapi\' request is reserved and will always return the path to the PnP file, from everywhere\n\n  if (request === `pnpapi`) {\n    return pnpFile;\n  }\n\n  // Bailout if the request is a native module\n\n  if (considerBuiltins && builtinModules.has(request)) {\n    return null;\n  }\n\n  // We allow disabling the pnp resolution for some subpaths. This is because some projects, often legacy,\n  // contain multiple levels of dependencies (ie. a yarn.lock inside a subfolder of a yarn.lock). This is\n  // typically solved using workspaces, but not all of them have been converted already.\n\n  if (ignorePattern && ignorePattern.test(normalizePath(issuer))) {\n    const result = callNativeResolution(request, issuer);\n\n    if (result === false) {\n      throw makeError(\n        `BUILTIN_NODE_RESOLUTION_FAIL`,\n        `The builtin node resolution algorithm was unable to resolve the module referenced by "${request}" and requested from "${issuer}" (it didn\'t go through the pnp resolver because the issuer was explicitely ignored by the regexp "$$BLACKLIST")`,\n        {\n          request,\n          issuer,\n        }\n      );\n    }\n\n    return result;\n  }\n\n  let unqualifiedPath;\n\n  // If the request is a relative or absolute path, we just return it normalized\n\n  const dependencyNameMatch = request.match(pathRegExp);\n\n  if (!dependencyNameMatch) {\n    if (path.isAbsolute(request)) {\n      unqualifiedPath = path.normalize(request);\n    } else if (issuer.match(isDirRegExp)) {\n      unqualifiedPath = path.normalize(path.resolve(issuer, request));\n    } else {\n      unqualifiedPath = path.normalize(path.resolve(path.dirname(issuer), request));\n    }\n  }\n\n  // Things are more hairy if it\'s a package require - we then need to figure out which package is needed, and in\n  // particular the exact version for the given location on the dependency tree\n\n  if (dependencyNameMatch) {\n    const [, dependencyName, subPath] = dependencyNameMatch;\n\n    const issuerLocator = exports.findPackageLocator(issuer);\n\n    // If the issuer file doesn\'t seem to be owned by a package managed through pnp, then we resort to using the next\n    // resolution algorithm in the chain, usually the native Node resolution one\n\n    if (!issuerLocator) {\n      const result = callNativeResolution(request, issuer);\n\n      if (result === false) {\n        throw makeError(\n          `BUILTIN_NODE_RESOLUTION_FAIL`,\n          `The builtin node resolution algorithm was unable to resolve the module referenced by "${request}" and requested from "${issuer}" (it didn\'t go through the pnp resolver because the issuer doesn\'t seem to be part of the Yarn-managed dependency tree)`,\n          {\n            request,\n            issuer,\n          }\n        );\n      }\n\n      return result;\n    }\n\n    const issuerInformation = getPackageInformationSafe(issuerLocator);\n\n    // We obtain the dependency reference in regard to the package that request it\n\n    let dependencyReference = issuerInformation.packageDependencies.get(dependencyName);\n\n    // If we can\'t find it, we check if we can potentially load it from the packages that have been defined as potential fallbacks.\n    // It\'s a bit of a hack, but it improves compatibility with the existing Node ecosystem. Hopefully we should eventually be able\n    // to kill this logic and become stricter once pnp gets enough traction and the affected packages fix themselves.\n\n    if (issuerLocator !== topLevelLocator) {\n      for (let t = 0, T = fallbackLocators.length; dependencyReference === undefined && t < T; ++t) {\n        const fallbackInformation = getPackageInformationSafe(fallbackLocators[t]);\n        dependencyReference = fallbackInformation.packageDependencies.get(dependencyName);\n      }\n    }\n\n    // If we can\'t find the path, and if the package making the request is the top-level, we can offer nicer error messages\n\n    if (!dependencyReference) {\n      if (dependencyReference === null) {\n        if (issuerLocator === topLevelLocator) {\n          throw makeError(\n            `MISSING_PEER_DEPENDENCY`,\n            `You seem to be requiring a peer dependency ("${dependencyName}"), but it is not installed (which might be because you\'re the top-level package)`,\n            {request, issuer, dependencyName}\n          );\n        } else {\n          throw makeError(\n            `MISSING_PEER_DEPENDENCY`,\n            `Package "${issuerLocator.name}@${issuerLocator.reference}" is trying to access a peer dependency ("${dependencyName}") that should be provided by its direct ancestor but isn\'t`,\n            {request, issuer, issuerLocator: Object.assign({}, issuerLocator), dependencyName}\n          );\n        }\n      } else {\n        if (issuerLocator === topLevelLocator) {\n          throw makeError(\n            `UNDECLARED_DEPENDENCY`,\n            `You cannot require a package ("${dependencyName}") that is not declared in your dependencies (via "${issuer}")`,\n            {request, issuer, dependencyName}\n          );\n        } else {\n          const candidates = Array.from(issuerInformation.packageDependencies.keys());\n          throw makeError(\n            `UNDECLARED_DEPENDENCY`,\n            `Package "${issuerLocator.name}@${issuerLocator.reference}" (via "${issuer}") is trying to require the package "${dependencyName}" (via "${request}") without it being listed in its dependencies (${candidates.join(\n              `, `\n            )})`,\n            {request, issuer, issuerLocator: Object.assign({}, issuerLocator), dependencyName, candidates}\n          );\n        }\n      }\n    }\n\n    // We need to check that the package exists on the filesystem, because it might not have been installed\n\n    const dependencyLocator = {name: dependencyName, reference: dependencyReference};\n    const dependencyInformation = exports.getPackageInformation(dependencyLocator);\n    const dependencyLocation = path.resolve(__dirname, dependencyInformation.packageLocation);\n\n    if (!dependencyLocation) {\n      throw makeError(\n        `MISSING_DEPENDENCY`,\n        `Package "${dependencyLocator.name}@${dependencyLocator.reference}" is a valid dependency, but hasn\'t been installed and thus cannot be required (it might be caused if you install a partial tree, such as on production environments)`,\n        {request, issuer, dependencyLocator: Object.assign({}, dependencyLocator)}\n      );\n    }\n\n    // Now that we know which package we should resolve to, we only have to find out the file location\n\n    if (subPath) {\n      unqualifiedPath = path.resolve(dependencyLocation, subPath);\n    } else {\n      unqualifiedPath = dependencyLocation;\n    }\n  }\n\n  return path.normalize(unqualifiedPath);\n};\n\n/**\n * Transforms an unqualified path into a qualified path by using the Node resolution algorithm (which automatically\n * appends ".js" / ".json", and transforms directory accesses into "index.js").\n */\n\nexports.resolveUnqualified = function resolveUnqualified(\n  unqualifiedPath,\n  {extensions = Object.keys(Module._extensions)} = {}\n) {\n  const qualifiedPath = applyNodeExtensionResolution(unqualifiedPath, {extensions});\n\n  if (qualifiedPath) {\n    return path.normalize(qualifiedPath);\n  } else {\n    throw makeError(\n      `QUALIFIED_PATH_RESOLUTION_FAILED`,\n      `Couldn\'t find a suitable Node resolution for unqualified path "${unqualifiedPath}"`,\n      {unqualifiedPath}\n    );\n  }\n};\n\n/**\n * Transforms a request into a fully qualified path.\n *\n * Note that it is extremely important that the `issuer` path ends with a forward slash if the issuer is to be\n * treated as a folder (ie. "/tmp/foo/" rather than "/tmp/foo" if "foo" is a directory). Otherwise relative\n * imports won\'t be computed correctly (they\'ll get resolved relative to "/tmp/" instead of "/tmp/foo/").\n */\n\nexports.resolveRequest = function resolveRequest(request, issuer, {considerBuiltins, extensions} = {}) {\n  let unqualifiedPath;\n\n  try {\n    unqualifiedPath = exports.resolveToUnqualified(request, issuer, {considerBuiltins});\n  } catch (originalError) {\n    // If we get a BUILTIN_NODE_RESOLUTION_FAIL error there, it means that we\'ve had to use the builtin node\n    // resolution, which usually shouldn\'t happen. It might be because the user is trying to require something\n    // from a path loaded through a symlink (which is not possible, because we need something normalized to\n    // figure out which package is making the require call), so we try to make the same request using a fully\n    // resolved issuer and throws a better and more actionable error if it works.\n    if (originalError.code === `BUILTIN_NODE_RESOLUTION_FAIL`) {\n      let realIssuer;\n\n      try {\n        realIssuer = realpathSync(issuer);\n      } catch (error) {}\n\n      if (realIssuer) {\n        if (issuer.endsWith(`/`)) {\n          realIssuer = realIssuer.replace(/\\/?$/, `/`);\n        }\n\n        try {\n          exports.resolveToUnqualified(request, realIssuer, {considerBuiltins});\n        } catch (error) {\n          // If an error was thrown, the problem doesn\'t seem to come from a path not being normalized, so we\n          // can just throw the original error which was legit.\n          throw originalError;\n        }\n\n        // If we reach this stage, it means that resolveToUnqualified didn\'t fail when using the fully resolved\n        // file path, which is very likely caused by a module being invoked through Node with a path not being\n        // correctly normalized (ie you should use "node $(realpath script.js)" instead of "node script.js").\n        throw makeError(\n          `SYMLINKED_PATH_DETECTED`,\n          `A pnp module ("${request}") has been required from what seems to be a symlinked path ("${issuer}"). This is not possible, you must ensure that your modules are invoked through their fully resolved path on the filesystem (in this case "${realIssuer}").`,\n          {\n            request,\n            issuer,\n            realIssuer,\n          }\n        );\n      }\n    }\n    throw originalError;\n  }\n\n  if (unqualifiedPath === null) {\n    return null;\n  }\n\n  try {\n    return exports.resolveUnqualified(unqualifiedPath, {extensions});\n  } catch (resolutionError) {\n    if (resolutionError.code === \'QUALIFIED_PATH_RESOLUTION_FAILED\') {\n      Object.assign(resolutionError.data, {request, issuer});\n    }\n    throw resolutionError;\n  }\n};\n\n/**\n * Setups the hook into the Node environment.\n *\n * From this point on, any call to `require()` will go through the "resolveRequest" function, and the result will\n * be used as path of the file to load.\n */\n\nexports.setup = function setup() {\n  // A small note: we don\'t replace the cache here (and instead use the native one). This is an effort to not\n  // break code similar to "delete require.cache[require.resolve(FOO)]", where FOO is a package located outside\n  // of the Yarn dependency tree. In this case, we defer the load to the native loader. If we were to replace the\n  // cache by our own, the native loader would populate its own cache, which wouldn\'t be exposed anymore, so the\n  // delete call would be broken.\n\n  const originalModuleLoad = Module._load;\n\n  Module._load = function(request, parent, isMain) {\n    if (!enableNativeHooks) {\n      return originalModuleLoad.call(Module, request, parent, isMain);\n    }\n\n    // Builtins are managed by the regular Node loader\n\n    if (builtinModules.has(request)) {\n      try {\n        enableNativeHooks = false;\n        return originalModuleLoad.call(Module, request, parent, isMain);\n      } finally {\n        enableNativeHooks = true;\n      }\n    }\n\n    // The \'pnpapi\' name is reserved to return the PnP api currently in use by the program\n\n    if (request === `pnpapi`) {\n      return pnpModule.exports;\n    }\n\n    // Request `Module._resolveFilename` (ie. `resolveRequest`) to tell us which file we should load\n\n    const modulePath = Module._resolveFilename(request, parent, isMain);\n\n    // Check if the module has already been created for the given file\n\n    const cacheEntry = Module._cache[modulePath];\n\n    if (cacheEntry) {\n      return cacheEntry.exports;\n    }\n\n    // Create a new module and store it into the cache\n\n    const module = new Module(modulePath, parent);\n    Module._cache[modulePath] = module;\n\n    // The main module is exposed as global variable\n\n    if (isMain) {\n      process.mainModule = module;\n      module.id = \'.\';\n    }\n\n    // Try to load the module, and remove it from the cache if it fails\n\n    let hasThrown = true;\n\n    try {\n      module.load(modulePath);\n      hasThrown = false;\n    } finally {\n      if (hasThrown) {\n        delete Module._cache[modulePath];\n      }\n    }\n\n    // Some modules might have to be patched for compatibility purposes\n\n    for (const [filter, patchFn] of patchedModules) {\n      if (filter.test(request)) {\n        module.exports = patchFn(exports.findPackageLocator(parent.filename), module.exports);\n      }\n    }\n\n    return module.exports;\n  };\n\n  const originalModuleResolveFilename = Module._resolveFilename;\n\n  Module._resolveFilename = function(request, parent, isMain, options) {\n    if (!enableNativeHooks) {\n      return originalModuleResolveFilename.call(Module, request, parent, isMain, options);\n    }\n\n    let issuers;\n\n    if (options) {\n      const optionNames = new Set(Object.keys(options));\n      optionNames.delete(\'paths\');\n\n      if (optionNames.size > 0) {\n        throw makeError(\n          `UNSUPPORTED`,\n          `Some options passed to require() aren\'t supported by PnP yet (${Array.from(optionNames).join(\', \')})`\n        );\n      }\n\n      if (options.paths) {\n        issuers = options.paths.map(entry => `${path.normalize(entry)}/`);\n      }\n    }\n\n    if (!issuers) {\n      const issuerModule = getIssuerModule(parent);\n      const issuer = issuerModule ? issuerModule.filename : `${process.cwd()}/`;\n\n      issuers = [issuer];\n    }\n\n    let firstError;\n\n    for (const issuer of issuers) {\n      let resolution;\n\n      try {\n        resolution = exports.resolveRequest(request, issuer);\n      } catch (error) {\n        firstError = firstError || error;\n        continue;\n      }\n\n      return resolution !== null ? resolution : request;\n    }\n\n    throw firstError;\n  };\n\n  const originalFindPath = Module._findPath;\n\n  Module._findPath = function(request, paths, isMain) {\n    if (!enableNativeHooks) {\n      return originalFindPath.call(Module, request, paths, isMain);\n    }\n\n    for (const path of paths) {\n      let resolution;\n\n      try {\n        resolution = exports.resolveRequest(request, path);\n      } catch (error) {\n        continue;\n      }\n\n      if (resolution) {\n        return resolution;\n      }\n    }\n\n    return false;\n  };\n\n  process.versions.pnp = String(exports.VERSIONS.std);\n};\n\nexports.setupCompatibilityLayer = () => {\n  // ESLint currently doesn\'t have any portable way for shared configs to specify their own\n  // plugins that should be used (https://github.com/eslint/eslint/issues/10125). This will\n  // likely get fixed at some point, but it\'ll take time and in the meantime we\'ll just add\n  // additional fallback entries for common shared configs.\n\n  for (const name of [`react-scripts`]) {\n    const packageInformationStore = packageInformationStores.get(name);\n    if (packageInformationStore) {\n      for (const reference of packageInformationStore.keys()) {\n        fallbackLocators.push({name, reference});\n      }\n    }\n  }\n\n  // Modern versions of `resolve` support a specific entry point that custom resolvers can use\n  // to inject a specific resolution logic without having to patch the whole package.\n  //\n  // Cf: https://github.com/browserify/resolve/pull/174\n\n  patchedModules.push([\n    /^\\.\\/normalize-options\\.js$/,\n    (issuer, normalizeOptions) => {\n      if (!issuer || issuer.name !== \'resolve\') {\n        return normalizeOptions;\n      }\n\n      return (request, opts) => {\n        opts = opts || {};\n\n        if (opts.forceNodeResolution) {\n          return opts;\n        }\n\n        opts.preserveSymlinks = true;\n        opts.paths = function(request, basedir, getNodeModulesDir, opts) {\n          // Extract the name of the package being requested (1=full name, 2=scope name, 3=local name)\n          const parts = request.match(/^((?:(@[^\\/]+)\\/)?([^\\/]+))/);\n\n          // make sure that basedir ends with a slash\n          if (basedir.charAt(basedir.length - 1) !== \'/\') {\n            basedir = path.join(basedir, \'/\');\n          }\n          // This is guaranteed to return the path to the "package.json" file from the given package\n          const manifestPath = exports.resolveToUnqualified(`${parts[1]}/package.json`, basedir);\n\n          // The first dirname strips the package.json, the second strips the local named folder\n          let nodeModules = path.dirname(path.dirname(manifestPath));\n\n          // Strips the scope named folder if needed\n          if (parts[2]) {\n            nodeModules = path.dirname(nodeModules);\n          }\n\n          return [nodeModules];\n        };\n\n        return opts;\n      };\n    },\n  ]);\n};\n\nif (module.parent && module.parent.id === \'internal/preload\') {\n  exports.setupCompatibilityLayer();\n\n  exports.setup();\n}\n\nif (process.mainModule === module) {\n  exports.setupCompatibilityLayer();\n\n  const reportError = (code, message, data) => {\n    process.stdout.write(`${JSON.stringify([{code, message, data}, null])}\\n`);\n  };\n\n  const reportSuccess = resolution => {\n    process.stdout.write(`${JSON.stringify([null, resolution])}\\n`);\n  };\n\n  const processResolution = (request, issuer) => {\n    try {\n      reportSuccess(exports.resolveRequest(request, issuer));\n    } catch (error) {\n      reportError(error.code, error.message, error.data);\n    }\n  };\n\n  const processRequest = data => {\n    try {\n      const [request, issuer] = JSON.parse(data);\n      processResolution(request, issuer);\n    } catch (error) {\n      reportError(`INVALID_JSON`, error.message, error.data);\n    }\n  };\n\n  if (process.argv.length > 2) {\n    if (process.argv.length !== 4) {\n      process.stderr.write(`Usage: ${process.argv[0]} ${process.argv[1]} <request> <issuer>\\n`);\n      process.exitCode = 64; /* EX_USAGE */\n    } else {\n      processResolution(process.argv[2], process.argv[3]);\n    }\n  } else {\n    let buffer = \'\';\n    const decoder = new StringDecoder.StringDecoder();\n\n    process.stdin.on(\'data\', chunk => {\n      buffer += decoder.write(chunk);\n\n      do {\n        const index = buffer.indexOf(\'\\n\');\n        if (index === -1) {\n          break;\n        }\n\n        const line = buffer.slice(0, index);\n        buffer = buffer.slice(index + 1);\n\n        processRequest(line);\n      } while (true);\n    });\n  }\n}\n';


const crypto = require('crypto');
const invariant = require('invariant');
const path = require('path');

const backwardSlashRegExp = /\\/g;

const OFFLINE_CACHE_EXTENSION = `.zip`;

function generateMaps(packageInformationStores, blacklistedLocations) {
  let code = ``;

  // Bake the information stores into our generated code
  code += `let packageInformationStores = new Map([\n`;
  for (var _iterator = packageInformationStores, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
    var _ref2;

    if (_isArray) {
      if (_i >= _iterator.length) break;
      _ref2 = _iterator[_i++];
    } else {
      _i = _iterator.next();
      if (_i.done) break;
      _ref2 = _i.value;
    }

    const _ref = _ref2;
    const packageName = _ref[0];
    const packageInformationStore = _ref[1];

    code += `  [${JSON.stringify(packageName)}, new Map([\n`;
    for (var _iterator4 = packageInformationStore, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
      var _ref7;

      if (_isArray4) {
        if (_i4 >= _iterator4.length) break;
        _ref7 = _iterator4[_i4++];
      } else {
        _i4 = _iterator4.next();
        if (_i4.done) break;
        _ref7 = _i4.value;
      }

      const _ref6 = _ref7;
      const packageReference = _ref6[0];
      var _ref6$ = _ref6[1];
      const packageLocation = _ref6$.packageLocation;
      const packageDependencies = _ref6$.packageDependencies;

      code += `    [${JSON.stringify(packageReference)}, {\n`;
      code += `      packageLocation: path.resolve(__dirname, ${JSON.stringify(packageLocation)}),\n`;
      code += `      packageDependencies: new Map([\n`;
      for (var _iterator5 = packageDependencies.entries(), _isArray5 = Array.isArray(_iterator5), _i5 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
        var _ref9;

        if (_isArray5) {
          if (_i5 >= _iterator5.length) break;
          _ref9 = _iterator5[_i5++];
        } else {
          _i5 = _iterator5.next();
          if (_i5.done) break;
          _ref9 = _i5.value;
        }

        const _ref8 = _ref9;
        const dependencyName = _ref8[0];
        const dependencyReference = _ref8[1];

        code += `        [${JSON.stringify(dependencyName)}, ${JSON.stringify(dependencyReference)}],\n`;
      }
      code += `      ]),\n`;
      code += `    }],\n`;
    }
    code += `  ])],\n`;
  }
  code += `]);\n`;

  code += `\n`;

  // Also bake an inverse map that will allow us to find the package information based on the path
  code += `let locatorsByLocations = new Map([\n`;
  for (var _iterator2 = blacklistedLocations, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
    var _ref3;

    if (_isArray2) {
      if (_i2 >= _iterator2.length) break;
      _ref3 = _iterator2[_i2++];
    } else {
      _i2 = _iterator2.next();
      if (_i2.done) break;
      _ref3 = _i2.value;
    }

    const blacklistedLocation = _ref3;

    code += `  [${JSON.stringify(blacklistedLocation)}, blacklistedLocator],\n`;
  }
  for (var _iterator3 = packageInformationStores, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
    var _ref5;

    if (_isArray3) {
      if (_i3 >= _iterator3.length) break;
      _ref5 = _iterator3[_i3++];
    } else {
      _i3 = _iterator3.next();
      if (_i3.done) break;
      _ref5 = _i3.value;
    }

    const _ref4 = _ref5;
    const packageName = _ref4[0];
    const packageInformationStore = _ref4[1];

    for (var _iterator6 = packageInformationStore, _isArray6 = Array.isArray(_iterator6), _i6 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
      var _ref11;

      if (_isArray6) {
        if (_i6 >= _iterator6.length) break;
        _ref11 = _iterator6[_i6++];
      } else {
        _i6 = _iterator6.next();
        if (_i6.done) break;
        _ref11 = _i6.value;
      }

      const _ref10 = _ref11;
      const packageReference = _ref10[0];
      const packageLocation = _ref10[1].packageLocation;

      if (packageName !== null) {
        code += `  [${JSON.stringify(packageLocation)}, ${JSON.stringify({
          name: packageName,
          reference: packageReference
        })}],\n`;
      } else {
        code += `  [${JSON.stringify(packageLocation)}, topLevelLocator],\n`;
      }
    }
  }
  code += `]);\n`;

  return code;
}

function generateFindPackageLocator(packageInformationStores) {
  let code = ``;

  // We get the list of each string length we'll need to check in order to find the current package context
  const lengths = new Map();

  for (var _iterator7 = packageInformationStores.values(), _isArray7 = Array.isArray(_iterator7), _i7 = 0, _iterator7 = _isArray7 ? _iterator7 : _iterator7[Symbol.iterator]();;) {
    var _ref12;

    if (_isArray7) {
      if (_i7 >= _iterator7.length) break;
      _ref12 = _iterator7[_i7++];
    } else {
      _i7 = _iterator7.next();
      if (_i7.done) break;
      _ref12 = _i7.value;
    }

    const packageInformationStore = _ref12;

    for (var _iterator9 = packageInformationStore.values(), _isArray9 = Array.isArray(_iterator9), _i9 = 0, _iterator9 = _isArray9 ? _iterator9 : _iterator9[Symbol.iterator]();;) {
      var _ref16;

      if (_isArray9) {
        if (_i9 >= _iterator9.length) break;
        _ref16 = _iterator9[_i9++];
      } else {
        _i9 = _iterator9.next();
        if (_i9.done) break;
        _ref16 = _i9.value;
      }

      const _ref15 = _ref16;
      const packageLocation = _ref15.packageLocation;

      if (packageLocation === null) {
        continue;
      }

      const length = packageLocation.length;
      const count = (lengths.get(length) || 0) + 1;

      lengths.set(length, count);
    }
  }

  // We must try the larger lengths before the smaller ones, because smaller ones might also match the longest ones
  // (for instance, /project/path will match /project/path/.pnp/global/node_modules/pnp-cf5f9c17b8f8db)
  const sortedLengths = Array.from(lengths.entries()).sort((a, b) => {
    return b[0] - a[0];
  });

  // Generate a function that, given a file path, returns the associated package name
  code += `exports.findPackageLocator = function findPackageLocator(location) {\n`;
  code += `  let relativeLocation = normalizePath(path.relative(__dirname, location));\n`;
  code += `\n`;
  code += `  if (!relativeLocation.match(isStrictRegExp))\n`;
  code += `    relativeLocation = \`./\${relativeLocation}\`;\n`;
  code += `\n`;
  code += `  if (location.match(isDirRegExp) && relativeLocation.charAt(relativeLocation.length - 1) !== '/')\n`;
  code += `    relativeLocation = \`\${relativeLocation}/\`;\n`;
  code += `\n`;
  code += `  let match;\n`;

  for (var _iterator8 = sortedLengths, _isArray8 = Array.isArray(_iterator8), _i8 = 0, _iterator8 = _isArray8 ? _iterator8 : _iterator8[Symbol.iterator]();;) {
    var _ref14;

    if (_isArray8) {
      if (_i8 >= _iterator8.length) break;
      _ref14 = _iterator8[_i8++];
    } else {
      _i8 = _iterator8.next();
      if (_i8.done) break;
      _ref14 = _i8.value;
    }

    const _ref13 = _ref14;
    const length = _ref13[0];

    code += `\n`;
    code += `  if (relativeLocation.length >= ${length} && relativeLocation[${length - 1}] === '/')\n`;
    code += `    if (match = locatorsByLocations.get(relativeLocation.substr(0, ${length})))\n`;
    code += `      return blacklistCheck(match);\n`;
  }

  code += `\n`;
  code += `  return null;\n`;
  code += `};\n`;

  return code;
}