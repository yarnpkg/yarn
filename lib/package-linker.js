'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.linkBin = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let linkBin = exports.linkBin = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (src, dest) {
    if (process.platform === 'win32') {
      const unlockMutex = yield (0, (_mutex || _load_mutex()).default)(src);
      try {
        yield cmdShim(src, dest, { createPwshFile: false });
      } finally {
        unlockMutex();
      }
    } else {
      yield (_fs || _load_fs()).mkdirp(path.dirname(dest));
      yield (_fs || _load_fs()).symlink(src, dest);
      yield (_fs || _load_fs()).chmod(dest, '755');
    }
  });

  return function linkBin(_x, _x2) {
    return _ref.apply(this, arguments);
  };
})();

var _packageHoister;

function _load_packageHoister() {
  return _packageHoister = _interopRequireDefault(require('./package-hoister.js'));
}

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('./constants.js'));
}

var _promise;

function _load_promise() {
  return _promise = _interopRequireWildcard(require('./util/promise.js'));
}

var _normalizePattern2;

function _load_normalizePattern() {
  return _normalizePattern2 = require('./util/normalize-pattern.js');
}

var _misc;

function _load_misc() {
  return _misc = require('./util/misc.js');
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('./util/fs.js'));
}

var _mutex;

function _load_mutex() {
  return _mutex = _interopRequireDefault(require('./util/mutex.js'));
}

var _semver;

function _load_semver() {
  return _semver = require('./util/semver.js');
}

var _workspaceLayout;

function _load_workspaceLayout() {
  return _workspaceLayout = _interopRequireDefault(require('./workspace-layout.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');

const cmdShim = require('@zkochan/cmd-shim');
const path = require('path');
const semver = require('semver');
// Concurrency for creating bin links disabled because of the issue #1961
const linkBinConcurrency = 1;

class PackageLinker {
  constructor(config, resolver) {
    this.resolver = resolver;
    this.reporter = config.reporter;
    this.config = config;
    this.artifacts = {};
    this.topLevelBinLinking = true;
    this.unplugged = [];
  }

  setArtifacts(artifacts) {
    this.artifacts = artifacts;
  }

  setTopLevelBinLinking(topLevelBinLinking) {
    this.topLevelBinLinking = topLevelBinLinking;
  }

  linkSelfDependencies(pkg, pkgLoc, targetBinLoc, override = false) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      targetBinLoc = path.join(targetBinLoc, '.bin');
      yield (_fs || _load_fs()).mkdirp(targetBinLoc);
      targetBinLoc = yield (_fs || _load_fs()).realpath(targetBinLoc);
      pkgLoc = yield (_fs || _load_fs()).realpath(pkgLoc);
      for (var _iterator = (0, (_misc || _load_misc()).entries)(pkg.bin), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref3;

        if (_isArray) {
          if (_i >= _iterator.length) break;
          _ref3 = _iterator[_i++];
        } else {
          _i = _iterator.next();
          if (_i.done) break;
          _ref3 = _i.value;
        }

        const _ref2 = _ref3;
        const scriptName = _ref2[0];
        const scriptCmd = _ref2[1];

        const dest = path.join(targetBinLoc, scriptName);
        const src = path.join(pkgLoc, scriptCmd);
        if (!(yield (_fs || _load_fs()).exists(src))) {
          if (!override) {
            // TODO maybe throw an error
            continue;
          }
        }
        yield linkBin(src, dest);
      }
    })();
  }

  linkBinDependencies(pkg, dir) {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const deps = [];

      const ref = pkg._reference;
      invariant(ref, 'Package reference is missing');

      const remote = pkg._remote;
      invariant(remote, 'Package remote is missing');

      // link up `bin scripts` in `dependencies`
      for (var _iterator2 = ref.dependencies, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
        var _ref4;

        if (_isArray2) {
          if (_i2 >= _iterator2.length) break;
          _ref4 = _iterator2[_i2++];
        } else {
          _i2 = _iterator2.next();
          if (_i2.done) break;
          _ref4 = _i2.value;
        }

        const pattern = _ref4;

        const dep = _this.resolver.getStrictResolvedPattern(pattern);
        if (
        // Missing locations means not installed inside node_modules
        dep._reference && dep._reference.locations.length && dep.bin && Object.keys(dep.bin).length) {
          const loc = yield _this.findNearestInstalledVersionOfPackage(dep, dir);
          deps.push({ dep, loc });
        }
      }

      // link up the `bin` scripts in bundled dependencies
      if (pkg.bundleDependencies) {
        for (var _iterator3 = pkg.bundleDependencies, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
          var _ref5;

          if (_isArray3) {
            if (_i3 >= _iterator3.length) break;
            _ref5 = _iterator3[_i3++];
          } else {
            _i3 = _iterator3.next();
            if (_i3.done) break;
            _ref5 = _i3.value;
          }

          const depName = _ref5;

          const locs = ref.locations.map(function (loc) {
            return path.join(loc, _this.config.getFolder(pkg), depName);
          });
          try {
            const dep = yield _this.config.readManifest(locs[0], remote.registry); //all of them should be the same

            if (dep.bin && Object.keys(dep.bin).length) {
              deps.push(...locs.map(function (loc) {
                return { dep, loc };
              }));
            }
          } catch (ex) {
            if (ex.code !== 'ENOENT') {
              throw ex;
            }
            // intentionally ignoring ENOENT error.
            // bundledDependency either does not exist or does not contain a package.json
          }
        }
      }

      // no deps to link
      if (!deps.length) {
        return;
      }

      // write the executables
      for (var _iterator4 = deps, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
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
        const dep = _ref6.dep,
              loc = _ref6.loc;

        if (dep._reference && dep._reference.locations.length) {
          invariant(!dep._reference.isPlugnplay, "Plug'n'play packages should not be referenced here");
          yield _this.linkSelfDependencies(dep, loc, dir);
        }
      }
    })();
  }

  //find the installation location of ref that would be used in binLoc based on node module resolution
  findNearestInstalledVersionOfPackage(pkg, binLoc) {
    var _this2 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const ref = pkg._reference;
      invariant(ref, 'expected pkg reference for ' + pkg.name);
      const moduleFolder = _this2.config.getFolder(pkg);
      yield (_fs || _load_fs()).mkdirp(binLoc);
      const realBinLoc = yield (_fs || _load_fs()).realpath(binLoc);

      const allLocations = [...ref.locations];
      const realLocations = yield Promise.all(ref.locations.map(function (loc) {
        return (_fs || _load_fs()).realpath(loc);
      }));
      realLocations.forEach(function (loc) {
        return allLocations.indexOf(loc) !== -1 || allLocations.push(loc);
      });

      const locationBinLocPairs = allLocations.map(function (loc) {
        return [loc, binLoc];
      });
      if (binLoc !== realBinLoc) {
        locationBinLocPairs.push(...allLocations.map(function (loc) {
          return [loc, realBinLoc];
        }));
      }

      const distancePairs = locationBinLocPairs.map(function ([loc, curBinLoc]) {
        let distance = 0;
        let curLoc = curBinLoc;
        let notFound = false;

        while (path.join(curLoc, ref.name) !== loc && path.join(curLoc, moduleFolder, ref.name) !== loc) {
          const next = path.dirname(curLoc);
          if (curLoc === next) {
            notFound = true;
            break;
          }

          distance++;
          curLoc = next;
        }
        return notFound ? null : [loc, distance];
      });

      //remove items where path was not found
      const filteredDistancePairs = distancePairs.filter(function (d) {
        return d;
      });
      filteredDistancePairs;

      invariant(filteredDistancePairs.length > 0, `could not find a copy of ${pkg.name} to link in ${binLoc}`);

      //get smallest distance from package location
      const minItem = filteredDistancePairs.reduce(function (min, cur) {
        return cur[1] < min[1] ? cur : min;
      });

      invariant(minItem[1] >= 0, 'could not find a target for bin dir of ' + minItem.toString());
      return minItem[0];
    })();
  }

  getFlatHoistedTree(patterns, workspaceLayout, { ignoreOptional } = {}) {
    const hoister = new (_packageHoister || _load_packageHoister()).default(this.config, this.resolver, { ignoreOptional, workspaceLayout });
    hoister.seed(patterns);
    if (this.config.focus) {
      hoister.markShallowWorkspaceEntries();
    }
    return hoister.init();
  }

  copyModules(patterns, workspaceLayout, { linkDuplicates, ignoreOptional } = {}) {
    var _this3 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      let flatTree = _this3.getFlatHoistedTree(patterns, workspaceLayout, { ignoreOptional });
      // sorted tree makes file creation and copying not to interfere with each other
      flatTree = flatTree.sort(function (dep1, dep2) {
        return dep1[0].localeCompare(dep2[0]);
      });

      // list of artifacts in modules to remove from extraneous removal
      const artifactFiles = [];

      const copyQueue = new Map();
      const hardlinkQueue = new Map();
      const hardlinksEnabled = linkDuplicates && (yield (_fs || _load_fs()).hardlinksWork(_this3.config.cwd));

      const copiedSrcs = new Map();
      const symlinkPaths = new Map();
      for (var _iterator5 = flatTree, _isArray5 = Array.isArray(_iterator5), _i5 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
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
        const folder = _ref8[0];
        var _ref8$ = _ref8[1];
        const pkg = _ref8$.pkg;
        const loc = _ref8$.loc;
        const isShallow = _ref8$.isShallow;

        const remote = pkg._remote || { type: '' };
        const ref = pkg._reference;
        let dest = folder;
        invariant(ref, 'expected package reference');

        let src = loc;
        let type = '';
        if (remote.type === 'link') {
          // replace package source from incorrect cache location (workspaces and link: are not cached)
          // with a symlink source
          src = remote.reference;
          type = 'symlink';
        } else if (workspaceLayout && remote.type === 'workspace' && !isShallow) {
          src = remote.reference;
          type = 'symlink';
          if (dest.indexOf(workspaceLayout.virtualManifestName) !== -1) {
            // we don't need to install virtual manifest
            continue;
          }
          // to get real path for non hoisted dependencies
          symlinkPaths.set(dest, src);
        } else {
          // backwards compatibility: get build artifacts from metadata
          // does not apply to symlinked dependencies
          const metadata = yield _this3.config.readPackageMetadata(src);
          for (var _iterator15 = metadata.artifacts, _isArray15 = Array.isArray(_iterator15), _i15 = 0, _iterator15 = _isArray15 ? _iterator15 : _iterator15[Symbol.iterator]();;) {
            var _ref23;

            if (_isArray15) {
              if (_i15 >= _iterator15.length) break;
              _ref23 = _iterator15[_i15++];
            } else {
              _i15 = _iterator15.next();
              if (_i15.done) break;
              _ref23 = _i15.value;
            }

            const file = _ref23;

            artifactFiles.push(path.join(dest, file));
          }
        }

        for (var _iterator16 = symlinkPaths.entries(), _isArray16 = Array.isArray(_iterator16), _i16 = 0, _iterator16 = _isArray16 ? _iterator16 : _iterator16[Symbol.iterator]();;) {
          var _ref25;

          if (_isArray16) {
            if (_i16 >= _iterator16.length) break;
            _ref25 = _iterator16[_i16++];
          } else {
            _i16 = _iterator16.next();
            if (_i16.done) break;
            _ref25 = _i16.value;
          }

          const _ref24 = _ref25;
          const symlink = _ref24[0];
          const realpath = _ref24[1];

          if (dest.indexOf(symlink + path.sep) === 0) {
            // after hoisting we end up with this structure
            // root/node_modules/workspace-package(symlink)/node_modules/package-a
            // fs.copy operations can't copy files through a symlink, so all the paths under workspace-package
            // need to be replaced with a real path, except for the symlink root/node_modules/workspace-package
            dest = dest.replace(symlink, realpath);
          }
        }

        if (_this3.config.plugnplayEnabled) {
          ref.isPlugnplay = true;
          if (yield _this3._isUnplugged(pkg, ref)) {
            dest = _this3.config.generatePackageUnpluggedPath(ref);

            // We don't skip the copy if the unplugged package isn't materialized yet
            if (yield (_fs || _load_fs()).exists(dest)) {
              ref.addLocation(dest);
              continue;
            }
          } else {
            ref.addLocation(src);
            continue;
          }
        }

        ref.addLocation(dest);

        const integrityArtifacts = _this3.artifacts[`${pkg.name}@${pkg.version}`];
        if (integrityArtifacts) {
          for (var _iterator17 = integrityArtifacts, _isArray17 = Array.isArray(_iterator17), _i17 = 0, _iterator17 = _isArray17 ? _iterator17 : _iterator17[Symbol.iterator]();;) {
            var _ref26;

            if (_isArray17) {
              if (_i17 >= _iterator17.length) break;
              _ref26 = _iterator17[_i17++];
            } else {
              _i17 = _iterator17.next();
              if (_i17.done) break;
              _ref26 = _i17.value;
            }

            const file = _ref26;

            artifactFiles.push(path.join(dest, file));
          }
        }

        const copiedDest = copiedSrcs.get(src);
        if (!copiedDest) {
          // no point to hardlink to a symlink
          if (hardlinksEnabled && type !== 'symlink') {
            copiedSrcs.set(src, dest);
          }
          copyQueue.set(dest, {
            src,
            dest,
            type,
            onFresh() {
              if (ref) {
                ref.setFresh(true);
              }
            }
          });
        } else {
          hardlinkQueue.set(dest, {
            src: copiedDest,
            dest,
            onFresh() {
              if (ref) {
                ref.setFresh(true);
              }
            }
          });
        }
      }

      const possibleExtraneous = new Set();
      const scopedPaths = new Set();

      const findExtraneousFiles = (() => {
        var _ref10 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (basePath) {
          for (var _iterator6 = _this3.config.registryFolders, _isArray6 = Array.isArray(_iterator6), _i6 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
            var _ref11;

            if (_isArray6) {
              if (_i6 >= _iterator6.length) break;
              _ref11 = _iterator6[_i6++];
            } else {
              _i6 = _iterator6.next();
              if (_i6.done) break;
              _ref11 = _i6.value;
            }

            const folder = _ref11;

            const loc = path.resolve(basePath, folder);

            if (yield (_fs || _load_fs()).exists(loc)) {
              const files = yield (_fs || _load_fs()).readdir(loc);

              for (var _iterator7 = files, _isArray7 = Array.isArray(_iterator7), _i7 = 0, _iterator7 = _isArray7 ? _iterator7 : _iterator7[Symbol.iterator]();;) {
                var _ref12;

                if (_isArray7) {
                  if (_i7 >= _iterator7.length) break;
                  _ref12 = _iterator7[_i7++];
                } else {
                  _i7 = _iterator7.next();
                  if (_i7.done) break;
                  _ref12 = _i7.value;
                }

                const file = _ref12;

                const filepath = path.join(loc, file);

                // it's a scope, not a package
                if (file[0] === '@') {
                  scopedPaths.add(filepath);

                  for (var _iterator8 = yield (_fs || _load_fs()).readdir(filepath), _isArray8 = Array.isArray(_iterator8), _i8 = 0, _iterator8 = _isArray8 ? _iterator8 : _iterator8[Symbol.iterator]();;) {
                    var _ref13;

                    if (_isArray8) {
                      if (_i8 >= _iterator8.length) break;
                      _ref13 = _iterator8[_i8++];
                    } else {
                      _i8 = _iterator8.next();
                      if (_i8.done) break;
                      _ref13 = _i8.value;
                    }

                    const subfile = _ref13;

                    possibleExtraneous.add(path.join(filepath, subfile));
                  }
                } else {
                  possibleExtraneous.add(filepath);
                }
              }
            }
          }
        });

        return function findExtraneousFiles(_x3) {
          return _ref10.apply(this, arguments);
        };
      })();

      yield findExtraneousFiles(_this3.config.lockfileFolder);
      if (workspaceLayout) {
        for (var _iterator9 = Object.keys(workspaceLayout.workspaces), _isArray9 = Array.isArray(_iterator9), _i9 = 0, _iterator9 = _isArray9 ? _iterator9 : _iterator9[Symbol.iterator]();;) {
          var _ref14;

          if (_isArray9) {
            if (_i9 >= _iterator9.length) break;
            _ref14 = _iterator9[_i9++];
          } else {
            _i9 = _iterator9.next();
            if (_i9.done) break;
            _ref14 = _i9.value;
          }

          const workspaceName = _ref14;

          yield findExtraneousFiles(workspaceLayout.workspaces[workspaceName].loc);
        }
      }

      // If an Extraneous is an entry created via "yarn link", we prevent it from being overwritten.
      // Unfortunately, the only way we can know if they have been created this way is to check if they
      // are symlinks - problem is that it then conflicts with the newly introduced "link:" protocol,
      // which also creates symlinks :( a somewhat weak fix is to check if the symlink target is registered
      // inside the linkFolder, in which case we assume it has been created via "yarn link". Otherwise, we
      // assume it's a link:-managed dependency, and overwrite it as usual.
      const linkTargets = new Map();

      let linkedModules;
      try {
        linkedModules = yield (_fs || _load_fs()).readdir(_this3.config.linkFolder);
      } catch (err) {
        if (err.code === 'ENOENT') {
          linkedModules = [];
        } else {
          throw err;
        }
      }

      // TODO: Consolidate this logic with `this.config.linkedModules` logic
      for (var _iterator10 = linkedModules, _isArray10 = Array.isArray(_iterator10), _i10 = 0, _iterator10 = _isArray10 ? _iterator10 : _iterator10[Symbol.iterator]();;) {
        var _ref15;

        if (_isArray10) {
          if (_i10 >= _iterator10.length) break;
          _ref15 = _iterator10[_i10++];
        } else {
          _i10 = _iterator10.next();
          if (_i10.done) break;
          _ref15 = _i10.value;
        }

        const entry = _ref15;

        const entryPath = path.join(_this3.config.linkFolder, entry);
        const stat = yield (_fs || _load_fs()).lstat(entryPath);

        if (stat.isSymbolicLink()) {
          try {
            const entryTarget = yield (_fs || _load_fs()).realpath(entryPath);
            linkTargets.set(entry, entryTarget);
          } catch (err) {
            _this3.reporter.warn(_this3.reporter.lang('linkTargetMissing', entry));
            yield (_fs || _load_fs()).unlink(entryPath);
          }
        } else if (stat.isDirectory() && entry[0] === '@') {
          // if the entry is directory beginning with '@', then we're dealing with a package scope, which
          // means we must iterate inside to retrieve the package names it contains
          const scopeName = entry;

          for (var _iterator18 = yield (_fs || _load_fs()).readdir(entryPath), _isArray18 = Array.isArray(_iterator18), _i18 = 0, _iterator18 = _isArray18 ? _iterator18 : _iterator18[Symbol.iterator]();;) {
            var _ref27;

            if (_isArray18) {
              if (_i18 >= _iterator18.length) break;
              _ref27 = _iterator18[_i18++];
            } else {
              _i18 = _iterator18.next();
              if (_i18.done) break;
              _ref27 = _i18.value;
            }

            const entry2 = _ref27;

            const entryPath2 = path.join(entryPath, entry2);
            const stat2 = yield (_fs || _load_fs()).lstat(entryPath2);

            if (stat2.isSymbolicLink()) {
              const packageName = `${scopeName}/${entry2}`;
              try {
                const entryTarget = yield (_fs || _load_fs()).realpath(entryPath2);
                linkTargets.set(packageName, entryTarget);
              } catch (err) {
                _this3.reporter.warn(_this3.reporter.lang('linkTargetMissing', packageName));
                yield (_fs || _load_fs()).unlink(entryPath2);
              }
            }
          }
        }
      }

      for (var _iterator11 = possibleExtraneous, _isArray11 = Array.isArray(_iterator11), _i11 = 0, _iterator11 = _isArray11 ? _iterator11 : _iterator11[Symbol.iterator]();;) {
        var _ref16;

        if (_isArray11) {
          if (_i11 >= _iterator11.length) break;
          _ref16 = _iterator11[_i11++];
        } else {
          _i11 = _iterator11.next();
          if (_i11.done) break;
          _ref16 = _i11.value;
        }

        const loc = _ref16;

        let packageName = path.basename(loc);
        const scopeName = path.basename(path.dirname(loc));

        if (scopeName[0] === `@`) {
          packageName = `${scopeName}/${packageName}`;
        }

        if ((yield (_fs || _load_fs()).lstat(loc)).isSymbolicLink() && linkTargets.has(packageName) && linkTargets.get(packageName) === (yield (_fs || _load_fs()).realpath(loc))) {
          possibleExtraneous.delete(loc);
          copyQueue.delete(loc);
        }
      }

      //
      let tick;
      yield (_fs || _load_fs()).copyBulk(Array.from(copyQueue.values()), _this3.reporter, {
        possibleExtraneous,
        artifactFiles,

        ignoreBasenames: [(_constants || _load_constants()).METADATA_FILENAME, (_constants || _load_constants()).TARBALL_FILENAME, '.bin'],

        onStart: function onStart(num) {
          tick = _this3.reporter.progress(num);
        },

        onProgress(src) {
          if (tick) {
            tick();
          }
        }
      });

      yield (_fs || _load_fs()).hardlinkBulk(Array.from(hardlinkQueue.values()), _this3.reporter, {
        possibleExtraneous,
        artifactFiles,

        onStart: function onStart(num) {
          tick = _this3.reporter.progress(num);
        },

        onProgress(src) {
          if (tick) {
            tick();
          }
        }
      });

      // remove all extraneous files that weren't in the tree
      for (var _iterator12 = possibleExtraneous, _isArray12 = Array.isArray(_iterator12), _i12 = 0, _iterator12 = _isArray12 ? _iterator12 : _iterator12[Symbol.iterator]();;) {
        var _ref17;

        if (_isArray12) {
          if (_i12 >= _iterator12.length) break;
          _ref17 = _iterator12[_i12++];
        } else {
          _i12 = _iterator12.next();
          if (_i12.done) break;
          _ref17 = _i12.value;
        }

        const loc = _ref17;

        _this3.reporter.verbose(_this3.reporter.lang('verboseFileRemoveExtraneous', loc));
        yield (_fs || _load_fs()).unlink(loc);
      }

      // remove any empty scoped directories
      for (var _iterator13 = scopedPaths, _isArray13 = Array.isArray(_iterator13), _i13 = 0, _iterator13 = _isArray13 ? _iterator13 : _iterator13[Symbol.iterator]();;) {
        var _ref18;

        if (_isArray13) {
          if (_i13 >= _iterator13.length) break;
          _ref18 = _iterator13[_i13++];
        } else {
          _i13 = _iterator13.next();
          if (_i13.done) break;
          _ref18 = _i13.value;
        }

        const scopedPath = _ref18;

        const files = yield (_fs || _load_fs()).readdir(scopedPath);
        if (files.length === 0) {
          yield (_fs || _load_fs()).unlink(scopedPath);
        }
      }

      // create binary links
      if (_this3.config.getOption('bin-links') && _this3.config.binLinks !== false) {
        const topLevelDependencies = _this3.determineTopLevelBinLinkOrder(flatTree);
        const tickBin = _this3.reporter.progress(flatTree.length + topLevelDependencies.length);

        // create links in transient dependencies
        yield (_promise || _load_promise()).queue(flatTree, (() => {
          var _ref19 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* ([dest, { pkg, isNohoist, parts }]) {
            if (pkg._reference && pkg._reference.locations.length && !pkg._reference.isPlugnplay) {
              const binLoc = path.join(dest, _this3.config.getFolder(pkg));
              yield _this3.linkBinDependencies(pkg, binLoc);
              if (isNohoist) {
                // if nohoist, we need to override the binLink to point to the local destination
                const parentBinLoc = _this3.getParentBinLoc(parts, flatTree);
                yield _this3.linkSelfDependencies(pkg, dest, parentBinLoc, true);
              }
              tickBin();
            }
            tickBin();
          });

          return function (_x4) {
            return _ref19.apply(this, arguments);
          };
        })(), linkBinConcurrency);

        // create links at top level for all dependencies.
        yield (_promise || _load_promise()).queue(topLevelDependencies, (() => {
          var _ref20 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* ([dest, { pkg }]) {
            if (pkg._reference && pkg._reference.locations.length && !pkg._reference.isPlugnplay && pkg.bin && Object.keys(pkg.bin).length) {
              let binLoc;
              if (_this3.config.modulesFolder) {
                binLoc = path.join(_this3.config.modulesFolder);
              } else {
                binLoc = path.join(_this3.config.lockfileFolder, _this3.config.getFolder(pkg));
              }
              yield _this3.linkSelfDependencies(pkg, dest, binLoc);
            }
            tickBin();
          });

          return function (_x5) {
            return _ref20.apply(this, arguments);
          };
        })(), linkBinConcurrency);
      }

      for (var _iterator14 = flatTree, _isArray14 = Array.isArray(_iterator14), _i14 = 0, _iterator14 = _isArray14 ? _iterator14 : _iterator14[Symbol.iterator]();;) {
        var _ref22;

        if (_isArray14) {
          if (_i14 >= _iterator14.length) break;
          _ref22 = _iterator14[_i14++];
        } else {
          _i14 = _iterator14.next();
          if (_i14.done) break;
          _ref22 = _i14.value;
        }

        const _ref21 = _ref22;
        const pkg = _ref21[1].pkg;

        yield _this3._warnForMissingBundledDependencies(pkg);
      }
    })();
  }

  _buildTreeHash(flatTree) {
    const hash = new Map();
    for (var _iterator19 = flatTree, _isArray19 = Array.isArray(_iterator19), _i19 = 0, _iterator19 = _isArray19 ? _iterator19 : _iterator19[Symbol.iterator]();;) {
      var _ref29;

      if (_isArray19) {
        if (_i19 >= _iterator19.length) break;
        _ref29 = _iterator19[_i19++];
      } else {
        _i19 = _iterator19.next();
        if (_i19.done) break;
        _ref29 = _i19.value;
      }

      const _ref28 = _ref29;
      const dest = _ref28[0];
      const hoistManifest = _ref28[1];

      const key = hoistManifest.parts.join('#');
      hash.set(key, [dest, hoistManifest]);
    }
    this._treeHash = hash;
    return hash;
  }

  getParentBinLoc(parts, flatTree) {
    const hash = this._treeHash || this._buildTreeHash(flatTree);
    const parent = parts.slice(0, -1).join('#');
    const tuple = hash.get(parent);
    if (!tuple) {
      throw new Error(`failed to get parent '${parent}' binLoc`);
    }
    const dest = tuple[0],
          hoistManifest = tuple[1];

    const parentBinLoc = path.join(dest, this.config.getFolder(hoistManifest.pkg));

    return parentBinLoc;
  }

  determineTopLevelBinLinkOrder(flatTree) {
    const linksToCreate = new Map();
    for (var _iterator20 = flatTree, _isArray20 = Array.isArray(_iterator20), _i20 = 0, _iterator20 = _isArray20 ? _iterator20 : _iterator20[Symbol.iterator]();;) {
      var _ref31;

      if (_isArray20) {
        if (_i20 >= _iterator20.length) break;
        _ref31 = _iterator20[_i20++];
      } else {
        _i20 = _iterator20.next();
        if (_i20.done) break;
        _ref31 = _i20.value;
      }

      const _ref30 = _ref31;
      const dest = _ref30[0];
      const hoistManifest = _ref30[1];
      const pkg = hoistManifest.pkg,
            isDirectRequire = hoistManifest.isDirectRequire,
            isNohoist = hoistManifest.isNohoist,
            isShallow = hoistManifest.isShallow;
      const name = pkg.name;

      // nohoist and shallow packages should not be linked at topLevel bin

      if (!isNohoist && !isShallow && (isDirectRequire || this.topLevelBinLinking && !linksToCreate.has(name))) {
        linksToCreate.set(name, [dest, hoistManifest]);
      }
    }

    // Sort the array so that direct dependencies will be linked last.
    // Bin links are overwritten if they already exist, so this will cause direct deps to take precedence.
    // If someone finds this to be incorrect later, you could also consider sorting descending by
    //   `linkToCreate.level` which is the dependency tree depth. Direct deps will have level 0 and transitive
    //   deps will have level > 0.
    const transientBins = [];
    const topLevelBins = [];
    for (var _iterator21 = Array.from(linksToCreate.values()), _isArray21 = Array.isArray(_iterator21), _i21 = 0, _iterator21 = _isArray21 ? _iterator21 : _iterator21[Symbol.iterator]();;) {
      var _ref32;

      if (_isArray21) {
        if (_i21 >= _iterator21.length) break;
        _ref32 = _iterator21[_i21++];
      } else {
        _i21 = _iterator21.next();
        if (_i21.done) break;
        _ref32 = _i21.value;
      }

      const linkToCreate = _ref32;

      if (linkToCreate[1].isDirectRequire) {
        topLevelBins.push(linkToCreate);
      } else {
        transientBins.push(linkToCreate);
      }
    }
    return [...transientBins, ...topLevelBins];
  }

  resolvePeerModules() {
    for (var _iterator22 = this.resolver.getManifests(), _isArray22 = Array.isArray(_iterator22), _i22 = 0, _iterator22 = _isArray22 ? _iterator22 : _iterator22[Symbol.iterator]();;) {
      var _ref33;

      if (_isArray22) {
        if (_i22 >= _iterator22.length) break;
        _ref33 = _iterator22[_i22++];
      } else {
        _i22 = _iterator22.next();
        if (_i22.done) break;
        _ref33 = _i22.value;
      }

      const pkg = _ref33;

      const peerDeps = pkg.peerDependencies;
      const peerDepsMeta = pkg.peerDependenciesMeta;

      if (!peerDeps) {
        continue;
      }

      const ref = pkg._reference;
      invariant(ref, 'Package reference is missing');

      // TODO: We are taking the "shortest" ref tree but there may be multiple ref trees with the same length
      const refTree = ref.requests.map(req => req.parentNames).sort((arr1, arr2) => arr1.length - arr2.length)[0];

      const getLevelDistance = pkgRef => {
        let minDistance = Infinity;
        for (var _iterator23 = pkgRef.requests, _isArray23 = Array.isArray(_iterator23), _i23 = 0, _iterator23 = _isArray23 ? _iterator23 : _iterator23[Symbol.iterator]();;) {
          var _ref34;

          if (_isArray23) {
            if (_i23 >= _iterator23.length) break;
            _ref34 = _iterator23[_i23++];
          } else {
            _i23 = _iterator23.next();
            if (_i23.done) break;
            _ref34 = _i23.value;
          }

          const req = _ref34;

          const distance = refTree.length - req.parentNames.length;

          if (distance >= 0 && distance < minDistance && req.parentNames.every((name, idx) => name === refTree[idx])) {
            minDistance = distance;
          }
        }

        return minDistance;
      };

      for (const peerDepName in peerDeps) {
        const range = peerDeps[peerDepName];
        const meta = peerDepsMeta && peerDepsMeta[peerDepName];

        const isOptional = !!(meta && meta.optional);

        const peerPkgs = this.resolver.getAllInfoForPackageName(peerDepName);

        let peerError = 'unmetPeer';
        let resolvedLevelDistance = Infinity;
        let resolvedPeerPkg;
        for (var _iterator24 = peerPkgs, _isArray24 = Array.isArray(_iterator24), _i24 = 0, _iterator24 = _isArray24 ? _iterator24 : _iterator24[Symbol.iterator]();;) {
          var _ref35;

          if (_isArray24) {
            if (_i24 >= _iterator24.length) break;
            _ref35 = _iterator24[_i24++];
          } else {
            _i24 = _iterator24.next();
            if (_i24.done) break;
            _ref35 = _i24.value;
          }

          const peerPkg = _ref35;

          const peerPkgRef = peerPkg._reference;
          if (!(peerPkgRef && peerPkgRef.patterns)) {
            continue;
          }
          const levelDistance = getLevelDistance(peerPkgRef);
          if (isFinite(levelDistance) && levelDistance < resolvedLevelDistance) {
            if (this._satisfiesPeerDependency(range, peerPkgRef.version)) {
              resolvedLevelDistance = levelDistance;
              resolvedPeerPkg = peerPkgRef;
            } else {
              peerError = 'incorrectPeer';
            }
          }
        }

        if (resolvedPeerPkg) {
          ref.addDependencies(resolvedPeerPkg.patterns);
          this.reporter.verbose(this.reporter.lang('selectedPeer', `${pkg.name}@${pkg.version}`, `${peerDepName}@${resolvedPeerPkg.version}`, resolvedPeerPkg.level));
        } else if (!isOptional) {
          this.reporter.warn(this.reporter.lang(peerError, `${refTree.join(' > ')} > ${pkg.name}@${pkg.version}`, `${peerDepName}@${range}`));
        }
      }
    }
  }

  _satisfiesPeerDependency(range, version) {
    return range === '*' || (0, (_semver || _load_semver()).satisfiesWithPrereleases)(version, range, this.config.looseSemver);
  }

  _warnForMissingBundledDependencies(pkg) {
    var _this4 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const ref = pkg._reference;
      invariant(ref, 'missing package ref ' + pkg.name);

      if (pkg.bundleDependencies) {
        for (var _iterator25 = pkg.bundleDependencies, _isArray25 = Array.isArray(_iterator25), _i25 = 0, _iterator25 = _isArray25 ? _iterator25 : _iterator25[Symbol.iterator]();;) {
          var _ref36;

          if (_isArray25) {
            if (_i25 >= _iterator25.length) break;
            _ref36 = _iterator25[_i25++];
          } else {
            _i25 = _iterator25.next();
            if (_i25.done) break;
            _ref36 = _i25.value;
          }

          const depName = _ref36;

          const locs = ref.locations.map(function (loc) {
            return path.join(loc, _this4.config.getFolder(pkg), depName);
          });
          const locsExist = yield Promise.all(locs.map(function (loc) {
            return (_fs || _load_fs()).exists(loc);
          }));
          if (locsExist.some(function (e) {
            return !e;
          })) {
            //if any of the locs do not exist
            const pkgHuman = `${pkg.name}@${pkg.version}`;
            _this4.reporter.warn(_this4.reporter.lang('missingBundledDependency', pkgHuman, depName));
          }
        }
      }
    })();
  }

  _isUnplugged(pkg, ref) {
    var _this5 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      // If an unplugged folder exists for the specified package, we simply use it
      if (yield (_fs || _load_fs()).exists(_this5.config.generatePackageUnpluggedPath(ref))) {
        return true;
      }

      // If the package has a postinstall script, we also unplug it (otherwise they would run into the cache)
      if (!_this5.config.ignoreScripts && pkg.scripts && (pkg.scripts.preinstall || pkg.scripts.install || pkg.scripts.postinstall)) {
        return true;
      }

      // Check whether the user explicitly requested for the package to be unplugged
      return _this5.unplugged.some(function (patternToUnplug) {
        var _normalizePattern = (0, (_normalizePattern2 || _load_normalizePattern()).normalizePattern)(patternToUnplug);

        const name = _normalizePattern.name,
              range = _normalizePattern.range,
              hasVersion = _normalizePattern.hasVersion;

        const satisfiesSemver = hasVersion ? semver.satisfies(ref.version, range) : true;
        return name === ref.name && satisfiesSemver;
      });
    })();
  }

  init(patterns, workspaceLayout, { linkDuplicates, ignoreOptional } = {}) {
    var _this6 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      _this6.resolvePeerModules();
      yield _this6.copyModules(patterns, workspaceLayout, { linkDuplicates, ignoreOptional });

      if (!_this6.config.plugnplayEnabled) {
        yield (_fs || _load_fs()).unlink(`${_this6.config.lockfileFolder}/${(_constants || _load_constants()).PNP_FILENAME}`);
      }
    })();
  }
}
exports.default = PackageLinker;