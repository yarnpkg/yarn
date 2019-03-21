'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getFirstSuitableFolder = exports.readFirstAvailableStream = exports.makeTempDir = exports.hardlinksWork = exports.writeFilePreservingEol = exports.getFileSizeOnDisk = exports.walk = exports.symlink = exports.find = exports.readJsonAndFile = exports.readJson = exports.readFileAny = exports.hardlinkBulk = exports.copyBulk = exports.unlink = exports.glob = exports.link = exports.chmod = exports.lstat = exports.exists = exports.mkdirp = exports.stat = exports.access = exports.rename = exports.readdir = exports.realpath = exports.readlink = exports.writeFile = exports.open = exports.readFileBuffer = exports.lockQueue = exports.constants = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let buildActionsForCopy = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (queue, events, possibleExtraneous, reporter) {

    //
    let build = (() => {
      var _ref5 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (data) {
        const src = data.src,
              dest = data.dest,
              type = data.type;

        const onFresh = data.onFresh || noop;
        const onDone = data.onDone || noop;

        // TODO https://github.com/yarnpkg/yarn/issues/3751
        // related to bundled dependencies handling
        if (files.has(dest.toLowerCase())) {
          reporter.verbose(`The case-insensitive file ${dest} shouldn't be copied twice in one bulk copy`);
        } else {
          files.add(dest.toLowerCase());
        }

        if (type === 'symlink') {
          yield mkdirp((_path || _load_path()).default.dirname(dest));
          onFresh();
          actions.symlink.push({
            dest,
            linkname: src
          });
          onDone();
          return;
        }

        if (events.ignoreBasenames.indexOf((_path || _load_path()).default.basename(src)) >= 0) {
          // ignored file
          return;
        }

        const srcStat = yield lstat(src);
        let srcFiles;

        if (srcStat.isDirectory()) {
          srcFiles = yield readdir(src);
        }

        let destStat;
        try {
          // try accessing the destination
          destStat = yield lstat(dest);
        } catch (e) {
          // proceed if destination doesn't exist, otherwise error
          if (e.code !== 'ENOENT') {
            throw e;
          }
        }

        // if destination exists
        if (destStat) {
          const bothSymlinks = srcStat.isSymbolicLink() && destStat.isSymbolicLink();
          const bothFolders = srcStat.isDirectory() && destStat.isDirectory();
          const bothFiles = srcStat.isFile() && destStat.isFile();

          // EINVAL access errors sometimes happen which shouldn't because node shouldn't be giving
          // us modes that aren't valid. investigate this, it's generally safe to proceed.

          /* if (srcStat.mode !== destStat.mode) {
            try {
              await access(dest, srcStat.mode);
            } catch (err) {}
          } */

          if (bothFiles && artifactFiles.has(dest)) {
            // this file gets changed during build, likely by a custom install script. Don't bother checking it.
            onDone();
            reporter.verbose(reporter.lang('verboseFileSkipArtifact', src));
            return;
          }

          if (bothFiles && srcStat.size === destStat.size && (0, (_fsNormalized || _load_fsNormalized()).fileDatesEqual)(srcStat.mtime, destStat.mtime)) {
            // we can safely assume this is the same file
            onDone();
            reporter.verbose(reporter.lang('verboseFileSkip', src, dest, srcStat.size, +srcStat.mtime));
            return;
          }

          if (bothSymlinks) {
            const srcReallink = yield readlink(src);
            if (srcReallink === (yield readlink(dest))) {
              // if both symlinks are the same then we can continue on
              onDone();
              reporter.verbose(reporter.lang('verboseFileSkipSymlink', src, dest, srcReallink));
              return;
            }
          }

          if (bothFolders) {
            // mark files that aren't in this folder as possibly extraneous
            const destFiles = yield readdir(dest);
            invariant(srcFiles, 'src files not initialised');

            for (var _iterator4 = destFiles, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
              var _ref6;

              if (_isArray4) {
                if (_i4 >= _iterator4.length) break;
                _ref6 = _iterator4[_i4++];
              } else {
                _i4 = _iterator4.next();
                if (_i4.done) break;
                _ref6 = _i4.value;
              }

              const file = _ref6;

              if (srcFiles.indexOf(file) < 0) {
                const loc = (_path || _load_path()).default.join(dest, file);
                possibleExtraneous.add(loc);

                if ((yield lstat(loc)).isDirectory()) {
                  for (var _iterator5 = yield readdir(loc), _isArray5 = Array.isArray(_iterator5), _i5 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
                    var _ref7;

                    if (_isArray5) {
                      if (_i5 >= _iterator5.length) break;
                      _ref7 = _iterator5[_i5++];
                    } else {
                      _i5 = _iterator5.next();
                      if (_i5.done) break;
                      _ref7 = _i5.value;
                    }

                    const file = _ref7;

                    possibleExtraneous.add((_path || _load_path()).default.join(loc, file));
                  }
                }
              }
            }
          }
        }

        if (destStat && destStat.isSymbolicLink()) {
          yield (0, (_fsNormalized || _load_fsNormalized()).unlink)(dest);
          destStat = null;
        }

        if (srcStat.isSymbolicLink()) {
          onFresh();
          const linkname = yield readlink(src);
          actions.symlink.push({
            dest,
            linkname
          });
          onDone();
        } else if (srcStat.isDirectory()) {
          if (!destStat) {
            reporter.verbose(reporter.lang('verboseFileFolder', dest));
            yield mkdirp(dest);
          }

          const destParts = dest.split((_path || _load_path()).default.sep);
          while (destParts.length) {
            files.add(destParts.join((_path || _load_path()).default.sep).toLowerCase());
            destParts.pop();
          }

          // push all files to queue
          invariant(srcFiles, 'src files not initialised');
          let remaining = srcFiles.length;
          if (!remaining) {
            onDone();
          }
          for (var _iterator6 = srcFiles, _isArray6 = Array.isArray(_iterator6), _i6 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
            var _ref8;

            if (_isArray6) {
              if (_i6 >= _iterator6.length) break;
              _ref8 = _iterator6[_i6++];
            } else {
              _i6 = _iterator6.next();
              if (_i6.done) break;
              _ref8 = _i6.value;
            }

            const file = _ref8;

            queue.push({
              dest: (_path || _load_path()).default.join(dest, file),
              onFresh,
              onDone: function (_onDone) {
                function onDone() {
                  return _onDone.apply(this, arguments);
                }

                onDone.toString = function () {
                  return _onDone.toString();
                };

                return onDone;
              }(function () {
                if (--remaining === 0) {
                  onDone();
                }
              }),
              src: (_path || _load_path()).default.join(src, file)
            });
          }
        } else if (srcStat.isFile()) {
          onFresh();
          actions.file.push({
            src,
            dest,
            atime: srcStat.atime,
            mtime: srcStat.mtime,
            mode: srcStat.mode
          });
          onDone();
        } else {
          throw new Error(`unsure how to copy this: ${src}`);
        }
      });

      return function build(_x5) {
        return _ref5.apply(this, arguments);
      };
    })();

    const artifactFiles = new Set(events.artifactFiles || []);
    const files = new Set();

    // initialise events
    for (var _iterator = queue, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref2;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref2 = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref2 = _i.value;
      }

      const item = _ref2;

      const onDone = item.onDone;
      item.onDone = function () {
        events.onProgress(item.dest);
        if (onDone) {
          onDone();
        }
      };
    }
    events.onStart(queue.length);

    // start building actions
    const actions = {
      file: [],
      symlink: [],
      link: []
    };

    // custom concurrency logic as we're always executing stacks of CONCURRENT_QUEUE_ITEMS queue items
    // at a time due to the requirement to push items onto the queue
    while (queue.length) {
      const items = queue.splice(0, CONCURRENT_QUEUE_ITEMS);
      yield Promise.all(items.map(build));
    }

    // simulate the existence of some files to prevent considering them extraneous
    for (var _iterator2 = artifactFiles, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
      var _ref3;

      if (_isArray2) {
        if (_i2 >= _iterator2.length) break;
        _ref3 = _iterator2[_i2++];
      } else {
        _i2 = _iterator2.next();
        if (_i2.done) break;
        _ref3 = _i2.value;
      }

      const file = _ref3;

      if (possibleExtraneous.has(file)) {
        reporter.verbose(reporter.lang('verboseFilePhantomExtraneous', file));
        possibleExtraneous.delete(file);
      }
    }

    for (var _iterator3 = possibleExtraneous, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
      var _ref4;

      if (_isArray3) {
        if (_i3 >= _iterator3.length) break;
        _ref4 = _iterator3[_i3++];
      } else {
        _i3 = _iterator3.next();
        if (_i3.done) break;
        _ref4 = _i3.value;
      }

      const loc = _ref4;

      if (files.has(loc.toLowerCase())) {
        possibleExtraneous.delete(loc);
      }
    }

    return actions;
  });

  return function buildActionsForCopy(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

let buildActionsForHardlink = (() => {
  var _ref9 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (queue, events, possibleExtraneous, reporter) {

    //
    let build = (() => {
      var _ref13 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (data) {
        const src = data.src,
              dest = data.dest;

        const onFresh = data.onFresh || noop;
        const onDone = data.onDone || noop;
        if (files.has(dest.toLowerCase())) {
          // Fixes issue https://github.com/yarnpkg/yarn/issues/2734
          // When bulk hardlinking we have A -> B structure that we want to hardlink to A1 -> B1,
          // package-linker passes that modules A1 and B1 need to be hardlinked,
          // the recursive linking algorithm of A1 ends up scheduling files in B1 to be linked twice which will case
          // an exception.
          onDone();
          return;
        }
        files.add(dest.toLowerCase());

        if (events.ignoreBasenames.indexOf((_path || _load_path()).default.basename(src)) >= 0) {
          // ignored file
          return;
        }

        const srcStat = yield lstat(src);
        let srcFiles;

        if (srcStat.isDirectory()) {
          srcFiles = yield readdir(src);
        }

        const destExists = yield exists(dest);
        if (destExists) {
          const destStat = yield lstat(dest);

          const bothSymlinks = srcStat.isSymbolicLink() && destStat.isSymbolicLink();
          const bothFolders = srcStat.isDirectory() && destStat.isDirectory();
          const bothFiles = srcStat.isFile() && destStat.isFile();

          if (srcStat.mode !== destStat.mode) {
            try {
              yield access(dest, srcStat.mode);
            } catch (err) {
              // EINVAL access errors sometimes happen which shouldn't because node shouldn't be giving
              // us modes that aren't valid. investigate this, it's generally safe to proceed.
              reporter.verbose(err);
            }
          }

          if (bothFiles && artifactFiles.has(dest)) {
            // this file gets changed during build, likely by a custom install script. Don't bother checking it.
            onDone();
            reporter.verbose(reporter.lang('verboseFileSkipArtifact', src));
            return;
          }

          // correct hardlink
          if (bothFiles && srcStat.ino !== null && srcStat.ino === destStat.ino) {
            onDone();
            reporter.verbose(reporter.lang('verboseFileSkip', src, dest, srcStat.ino));
            return;
          }

          if (bothSymlinks) {
            const srcReallink = yield readlink(src);
            if (srcReallink === (yield readlink(dest))) {
              // if both symlinks are the same then we can continue on
              onDone();
              reporter.verbose(reporter.lang('verboseFileSkipSymlink', src, dest, srcReallink));
              return;
            }
          }

          if (bothFolders) {
            // mark files that aren't in this folder as possibly extraneous
            const destFiles = yield readdir(dest);
            invariant(srcFiles, 'src files not initialised');

            for (var _iterator10 = destFiles, _isArray10 = Array.isArray(_iterator10), _i10 = 0, _iterator10 = _isArray10 ? _iterator10 : _iterator10[Symbol.iterator]();;) {
              var _ref14;

              if (_isArray10) {
                if (_i10 >= _iterator10.length) break;
                _ref14 = _iterator10[_i10++];
              } else {
                _i10 = _iterator10.next();
                if (_i10.done) break;
                _ref14 = _i10.value;
              }

              const file = _ref14;

              if (srcFiles.indexOf(file) < 0) {
                const loc = (_path || _load_path()).default.join(dest, file);
                possibleExtraneous.add(loc);

                if ((yield lstat(loc)).isDirectory()) {
                  for (var _iterator11 = yield readdir(loc), _isArray11 = Array.isArray(_iterator11), _i11 = 0, _iterator11 = _isArray11 ? _iterator11 : _iterator11[Symbol.iterator]();;) {
                    var _ref15;

                    if (_isArray11) {
                      if (_i11 >= _iterator11.length) break;
                      _ref15 = _iterator11[_i11++];
                    } else {
                      _i11 = _iterator11.next();
                      if (_i11.done) break;
                      _ref15 = _i11.value;
                    }

                    const file = _ref15;

                    possibleExtraneous.add((_path || _load_path()).default.join(loc, file));
                  }
                }
              }
            }
          }
        }

        if (srcStat.isSymbolicLink()) {
          onFresh();
          const linkname = yield readlink(src);
          actions.symlink.push({
            dest,
            linkname
          });
          onDone();
        } else if (srcStat.isDirectory()) {
          reporter.verbose(reporter.lang('verboseFileFolder', dest));
          yield mkdirp(dest);

          const destParts = dest.split((_path || _load_path()).default.sep);
          while (destParts.length) {
            files.add(destParts.join((_path || _load_path()).default.sep).toLowerCase());
            destParts.pop();
          }

          // push all files to queue
          invariant(srcFiles, 'src files not initialised');
          let remaining = srcFiles.length;
          if (!remaining) {
            onDone();
          }
          for (var _iterator12 = srcFiles, _isArray12 = Array.isArray(_iterator12), _i12 = 0, _iterator12 = _isArray12 ? _iterator12 : _iterator12[Symbol.iterator]();;) {
            var _ref16;

            if (_isArray12) {
              if (_i12 >= _iterator12.length) break;
              _ref16 = _iterator12[_i12++];
            } else {
              _i12 = _iterator12.next();
              if (_i12.done) break;
              _ref16 = _i12.value;
            }

            const file = _ref16;

            queue.push({
              onFresh,
              src: (_path || _load_path()).default.join(src, file),
              dest: (_path || _load_path()).default.join(dest, file),
              onDone: function (_onDone2) {
                function onDone() {
                  return _onDone2.apply(this, arguments);
                }

                onDone.toString = function () {
                  return _onDone2.toString();
                };

                return onDone;
              }(function () {
                if (--remaining === 0) {
                  onDone();
                }
              })
            });
          }
        } else if (srcStat.isFile()) {
          onFresh();
          actions.link.push({
            src,
            dest,
            removeDest: destExists
          });
          onDone();
        } else {
          throw new Error(`unsure how to copy this: ${src}`);
        }
      });

      return function build(_x10) {
        return _ref13.apply(this, arguments);
      };
    })();

    const artifactFiles = new Set(events.artifactFiles || []);
    const files = new Set();

    // initialise events
    for (var _iterator7 = queue, _isArray7 = Array.isArray(_iterator7), _i7 = 0, _iterator7 = _isArray7 ? _iterator7 : _iterator7[Symbol.iterator]();;) {
      var _ref10;

      if (_isArray7) {
        if (_i7 >= _iterator7.length) break;
        _ref10 = _iterator7[_i7++];
      } else {
        _i7 = _iterator7.next();
        if (_i7.done) break;
        _ref10 = _i7.value;
      }

      const item = _ref10;

      const onDone = item.onDone || noop;
      item.onDone = function () {
        events.onProgress(item.dest);
        onDone();
      };
    }
    events.onStart(queue.length);

    // start building actions
    const actions = {
      file: [],
      symlink: [],
      link: []
    };

    // custom concurrency logic as we're always executing stacks of CONCURRENT_QUEUE_ITEMS queue items
    // at a time due to the requirement to push items onto the queue
    while (queue.length) {
      const items = queue.splice(0, CONCURRENT_QUEUE_ITEMS);
      yield Promise.all(items.map(build));
    }

    // simulate the existence of some files to prevent considering them extraneous
    for (var _iterator8 = artifactFiles, _isArray8 = Array.isArray(_iterator8), _i8 = 0, _iterator8 = _isArray8 ? _iterator8 : _iterator8[Symbol.iterator]();;) {
      var _ref11;

      if (_isArray8) {
        if (_i8 >= _iterator8.length) break;
        _ref11 = _iterator8[_i8++];
      } else {
        _i8 = _iterator8.next();
        if (_i8.done) break;
        _ref11 = _i8.value;
      }

      const file = _ref11;

      if (possibleExtraneous.has(file)) {
        reporter.verbose(reporter.lang('verboseFilePhantomExtraneous', file));
        possibleExtraneous.delete(file);
      }
    }

    for (var _iterator9 = possibleExtraneous, _isArray9 = Array.isArray(_iterator9), _i9 = 0, _iterator9 = _isArray9 ? _iterator9 : _iterator9[Symbol.iterator]();;) {
      var _ref12;

      if (_isArray9) {
        if (_i9 >= _iterator9.length) break;
        _ref12 = _iterator9[_i9++];
      } else {
        _i9 = _iterator9.next();
        if (_i9.done) break;
        _ref12 = _i9.value;
      }

      const loc = _ref12;

      if (files.has(loc.toLowerCase())) {
        possibleExtraneous.delete(loc);
      }
    }

    return actions;
  });

  return function buildActionsForHardlink(_x6, _x7, _x8, _x9) {
    return _ref9.apply(this, arguments);
  };
})();

let copyBulk = exports.copyBulk = (() => {
  var _ref17 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (queue, reporter, _events) {
    const events = {
      onStart: _events && _events.onStart || noop,
      onProgress: _events && _events.onProgress || noop,
      possibleExtraneous: _events ? _events.possibleExtraneous : new Set(),
      ignoreBasenames: _events && _events.ignoreBasenames || [],
      artifactFiles: _events && _events.artifactFiles || []
    };

    const actions = yield buildActionsForCopy(queue, events, events.possibleExtraneous, reporter);
    events.onStart(actions.file.length + actions.symlink.length + actions.link.length);

    const fileActions = actions.file;

    const currentlyWriting = new Map();

    yield (_promise || _load_promise()).queue(fileActions, (() => {
      var _ref18 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (data) {
        let writePromise;
        while (writePromise = currentlyWriting.get(data.dest)) {
          yield writePromise;
        }

        reporter.verbose(reporter.lang('verboseFileCopy', data.src, data.dest));
        const copier = (0, (_fsNormalized || _load_fsNormalized()).copyFile)(data, function () {
          return currentlyWriting.delete(data.dest);
        });
        currentlyWriting.set(data.dest, copier);
        events.onProgress(data.dest);
        return copier;
      });

      return function (_x14) {
        return _ref18.apply(this, arguments);
      };
    })(), CONCURRENT_QUEUE_ITEMS);

    // we need to copy symlinks last as they could reference files we were copying
    const symlinkActions = actions.symlink;
    yield (_promise || _load_promise()).queue(symlinkActions, function (data) {
      const linkname = (_path || _load_path()).default.resolve((_path || _load_path()).default.dirname(data.dest), data.linkname);
      reporter.verbose(reporter.lang('verboseFileSymlink', data.dest, linkname));
      return symlink(linkname, data.dest);
    });
  });

  return function copyBulk(_x11, _x12, _x13) {
    return _ref17.apply(this, arguments);
  };
})();

let hardlinkBulk = exports.hardlinkBulk = (() => {
  var _ref19 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (queue, reporter, _events) {
    const events = {
      onStart: _events && _events.onStart || noop,
      onProgress: _events && _events.onProgress || noop,
      possibleExtraneous: _events ? _events.possibleExtraneous : new Set(),
      artifactFiles: _events && _events.artifactFiles || [],
      ignoreBasenames: []
    };

    const actions = yield buildActionsForHardlink(queue, events, events.possibleExtraneous, reporter);
    events.onStart(actions.file.length + actions.symlink.length + actions.link.length);

    const fileActions = actions.link;

    yield (_promise || _load_promise()).queue(fileActions, (() => {
      var _ref20 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (data) {
        reporter.verbose(reporter.lang('verboseFileLink', data.src, data.dest));
        if (data.removeDest) {
          yield (0, (_fsNormalized || _load_fsNormalized()).unlink)(data.dest);
        }
        yield link(data.src, data.dest);
      });

      return function (_x18) {
        return _ref20.apply(this, arguments);
      };
    })(), CONCURRENT_QUEUE_ITEMS);

    // we need to copy symlinks last as they could reference files we were copying
    const symlinkActions = actions.symlink;
    yield (_promise || _load_promise()).queue(symlinkActions, function (data) {
      const linkname = (_path || _load_path()).default.resolve((_path || _load_path()).default.dirname(data.dest), data.linkname);
      reporter.verbose(reporter.lang('verboseFileSymlink', data.dest, linkname));
      return symlink(linkname, data.dest);
    });
  });

  return function hardlinkBulk(_x15, _x16, _x17) {
    return _ref19.apply(this, arguments);
  };
})();

let readFileAny = exports.readFileAny = (() => {
  var _ref21 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (files) {
    for (var _iterator13 = files, _isArray13 = Array.isArray(_iterator13), _i13 = 0, _iterator13 = _isArray13 ? _iterator13 : _iterator13[Symbol.iterator]();;) {
      var _ref22;

      if (_isArray13) {
        if (_i13 >= _iterator13.length) break;
        _ref22 = _iterator13[_i13++];
      } else {
        _i13 = _iterator13.next();
        if (_i13.done) break;
        _ref22 = _i13.value;
      }

      const file = _ref22;

      if (yield exists(file)) {
        return readFile(file);
      }
    }
    return null;
  });

  return function readFileAny(_x19) {
    return _ref21.apply(this, arguments);
  };
})();

let readJson = exports.readJson = (() => {
  var _ref23 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (loc) {
    return (yield readJsonAndFile(loc)).object;
  });

  return function readJson(_x20) {
    return _ref23.apply(this, arguments);
  };
})();

let readJsonAndFile = exports.readJsonAndFile = (() => {
  var _ref24 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (loc) {
    const file = yield readFile(loc);
    try {
      return {
        object: (0, (_map || _load_map()).default)(JSON.parse(stripBOM(file))),
        content: file
      };
    } catch (err) {
      err.message = `${loc}: ${err.message}`;
      throw err;
    }
  });

  return function readJsonAndFile(_x21) {
    return _ref24.apply(this, arguments);
  };
})();

let find = exports.find = (() => {
  var _ref25 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (filename, dir) {
    const parts = dir.split((_path || _load_path()).default.sep);

    while (parts.length) {
      const loc = parts.concat(filename).join((_path || _load_path()).default.sep);

      if (yield exists(loc)) {
        return loc;
      } else {
        parts.pop();
      }
    }

    return false;
  });

  return function find(_x22, _x23) {
    return _ref25.apply(this, arguments);
  };
})();

let symlink = exports.symlink = (() => {
  var _ref26 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (src, dest) {
    if (process.platform !== 'win32') {
      // use relative paths otherwise which will be retained if the directory is moved
      src = (_path || _load_path()).default.relative((_path || _load_path()).default.dirname(dest), src);
      // When path.relative returns an empty string for the current directory, we should instead use
      // '.', which is a valid fs.symlink target.
      src = src || '.';
    }

    try {
      const stats = yield lstat(dest);
      if (stats.isSymbolicLink()) {
        const resolved = dest;
        if (resolved === src) {
          return;
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }

    // We use rimraf for unlink which never throws an ENOENT on missing target
    yield (0, (_fsNormalized || _load_fsNormalized()).unlink)(dest);

    if (process.platform === 'win32') {
      // use directory junctions if possible on win32, this requires absolute paths
      yield fsSymlink(src, dest, 'junction');
    } else {
      yield fsSymlink(src, dest);
    }
  });

  return function symlink(_x24, _x25) {
    return _ref26.apply(this, arguments);
  };
})();

let walk = exports.walk = (() => {
  var _ref27 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (dir, relativeDir, ignoreBasenames = new Set()) {
    let files = [];

    let filenames = yield readdir(dir);
    if (ignoreBasenames.size) {
      filenames = filenames.filter(function (name) {
        return !ignoreBasenames.has(name);
      });
    }

    for (var _iterator14 = filenames, _isArray14 = Array.isArray(_iterator14), _i14 = 0, _iterator14 = _isArray14 ? _iterator14 : _iterator14[Symbol.iterator]();;) {
      var _ref28;

      if (_isArray14) {
        if (_i14 >= _iterator14.length) break;
        _ref28 = _iterator14[_i14++];
      } else {
        _i14 = _iterator14.next();
        if (_i14.done) break;
        _ref28 = _i14.value;
      }

      const name = _ref28;

      const relative = relativeDir ? (_path || _load_path()).default.join(relativeDir, name) : name;
      const loc = (_path || _load_path()).default.join(dir, name);
      const stat = yield lstat(loc);

      files.push({
        relative,
        basename: name,
        absolute: loc,
        mtime: +stat.mtime
      });

      if (stat.isDirectory()) {
        files = files.concat((yield walk(loc, relative, ignoreBasenames)));
      }
    }

    return files;
  });

  return function walk(_x26, _x27) {
    return _ref27.apply(this, arguments);
  };
})();

let getFileSizeOnDisk = exports.getFileSizeOnDisk = (() => {
  var _ref29 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (loc) {
    const stat = yield lstat(loc);
    const size = stat.size,
          blockSize = stat.blksize;


    return Math.ceil(size / blockSize) * blockSize;
  });

  return function getFileSizeOnDisk(_x28) {
    return _ref29.apply(this, arguments);
  };
})();

let getEolFromFile = (() => {
  var _ref30 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (path) {
    if (!(yield exists(path))) {
      return undefined;
    }

    const buffer = yield readFileBuffer(path);

    for (let i = 0; i < buffer.length; ++i) {
      if (buffer[i] === cr) {
        return '\r\n';
      }
      if (buffer[i] === lf) {
        return '\n';
      }
    }
    return undefined;
  });

  return function getEolFromFile(_x29) {
    return _ref30.apply(this, arguments);
  };
})();

let writeFilePreservingEol = exports.writeFilePreservingEol = (() => {
  var _ref31 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (path, data) {
    const eol = (yield getEolFromFile(path)) || (_os || _load_os()).default.EOL;
    if (eol !== '\n') {
      data = data.replace(/\n/g, eol);
    }
    yield writeFile(path, data);
  });

  return function writeFilePreservingEol(_x30, _x31) {
    return _ref31.apply(this, arguments);
  };
})();

let hardlinksWork = exports.hardlinksWork = (() => {
  var _ref32 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (dir) {
    const filename = 'test-file' + Math.random();
    const file = (_path || _load_path()).default.join(dir, filename);
    const fileLink = (_path || _load_path()).default.join(dir, filename + '-link');
    try {
      yield writeFile(file, 'test');
      yield link(file, fileLink);
    } catch (err) {
      return false;
    } finally {
      yield (0, (_fsNormalized || _load_fsNormalized()).unlink)(file);
      yield (0, (_fsNormalized || _load_fsNormalized()).unlink)(fileLink);
    }
    return true;
  });

  return function hardlinksWork(_x32) {
    return _ref32.apply(this, arguments);
  };
})();

// not a strict polyfill for Node's fs.mkdtemp


let makeTempDir = exports.makeTempDir = (() => {
  var _ref33 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (prefix) {
    const dir = (_path || _load_path()).default.join((_os || _load_os()).default.tmpdir(), `yarn-${prefix || ''}-${Date.now()}-${Math.random()}`);
    yield (0, (_fsNormalized || _load_fsNormalized()).unlink)(dir);
    yield mkdirp(dir);
    return dir;
  });

  return function makeTempDir(_x33) {
    return _ref33.apply(this, arguments);
  };
})();

let readFirstAvailableStream = exports.readFirstAvailableStream = (() => {
  var _ref34 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (paths) {
    for (var _iterator15 = paths, _isArray15 = Array.isArray(_iterator15), _i15 = 0, _iterator15 = _isArray15 ? _iterator15 : _iterator15[Symbol.iterator]();;) {
      var _ref35;

      if (_isArray15) {
        if (_i15 >= _iterator15.length) break;
        _ref35 = _iterator15[_i15++];
      } else {
        _i15 = _iterator15.next();
        if (_i15.done) break;
        _ref35 = _i15.value;
      }

      const path = _ref35;

      try {
        const fd = yield open(path, 'r');
        return (_fs || _load_fs()).default.createReadStream(path, { fd });
      } catch (err) {
        // Try the next one
      }
    }
    return null;
  });

  return function readFirstAvailableStream(_x34) {
    return _ref34.apply(this, arguments);
  };
})();

let getFirstSuitableFolder = exports.getFirstSuitableFolder = (() => {
  var _ref36 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (paths, mode = constants.W_OK | constants.X_OK) {
    const result = {
      skipped: [],
      folder: null
    };

    for (var _iterator16 = paths, _isArray16 = Array.isArray(_iterator16), _i16 = 0, _iterator16 = _isArray16 ? _iterator16 : _iterator16[Symbol.iterator]();;) {
      var _ref37;

      if (_isArray16) {
        if (_i16 >= _iterator16.length) break;
        _ref37 = _iterator16[_i16++];
      } else {
        _i16 = _iterator16.next();
        if (_i16.done) break;
        _ref37 = _i16.value;
      }

      const folder = _ref37;

      try {
        yield mkdirp(folder);
        yield access(folder, mode);

        result.folder = folder;

        return result;
      } catch (error) {
        result.skipped.push({
          error,
          folder
        });
      }
    }
    return result;
  });

  return function getFirstSuitableFolder(_x35) {
    return _ref36.apply(this, arguments);
  };
})();

exports.copy = copy;
exports.readFile = readFile;
exports.readFileRaw = readFileRaw;
exports.normalizeOS = normalizeOS;

var _fs;

function _load_fs() {
  return _fs = _interopRequireDefault(require('fs'));
}

var _glob;

function _load_glob() {
  return _glob = _interopRequireDefault(require('glob'));
}

var _os;

function _load_os() {
  return _os = _interopRequireDefault(require('os'));
}

var _path;

function _load_path() {
  return _path = _interopRequireDefault(require('path'));
}

var _blockingQueue;

function _load_blockingQueue() {
  return _blockingQueue = _interopRequireDefault(require('./blocking-queue.js'));
}

var _promise;

function _load_promise() {
  return _promise = _interopRequireWildcard(require('./promise.js'));
}

var _promise2;

function _load_promise2() {
  return _promise2 = require('./promise.js');
}

var _map;

function _load_map() {
  return _map = _interopRequireDefault(require('./map.js'));
}

var _fsNormalized;

function _load_fsNormalized() {
  return _fsNormalized = require('./fs-normalized.js');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const constants = exports.constants = typeof (_fs || _load_fs()).default.constants !== 'undefined' ? (_fs || _load_fs()).default.constants : {
  R_OK: (_fs || _load_fs()).default.R_OK,
  W_OK: (_fs || _load_fs()).default.W_OK,
  X_OK: (_fs || _load_fs()).default.X_OK
};

const lockQueue = exports.lockQueue = new (_blockingQueue || _load_blockingQueue()).default('fs lock');

const readFileBuffer = exports.readFileBuffer = (0, (_promise2 || _load_promise2()).promisify)((_fs || _load_fs()).default.readFile);
const open = exports.open = (0, (_promise2 || _load_promise2()).promisify)((_fs || _load_fs()).default.open);
const writeFile = exports.writeFile = (0, (_promise2 || _load_promise2()).promisify)((_fs || _load_fs()).default.writeFile);
const readlink = exports.readlink = (0, (_promise2 || _load_promise2()).promisify)((_fs || _load_fs()).default.readlink);
const realpath = exports.realpath = (0, (_promise2 || _load_promise2()).promisify)((_fs || _load_fs()).default.realpath);
const readdir = exports.readdir = (0, (_promise2 || _load_promise2()).promisify)((_fs || _load_fs()).default.readdir);
const rename = exports.rename = (0, (_promise2 || _load_promise2()).promisify)((_fs || _load_fs()).default.rename);
const access = exports.access = (0, (_promise2 || _load_promise2()).promisify)((_fs || _load_fs()).default.access);
const stat = exports.stat = (0, (_promise2 || _load_promise2()).promisify)((_fs || _load_fs()).default.stat);
const mkdirp = exports.mkdirp = (0, (_promise2 || _load_promise2()).promisify)(require('mkdirp'));
const exists = exports.exists = (0, (_promise2 || _load_promise2()).promisify)((_fs || _load_fs()).default.exists, true);
const lstat = exports.lstat = (0, (_promise2 || _load_promise2()).promisify)((_fs || _load_fs()).default.lstat);
const chmod = exports.chmod = (0, (_promise2 || _load_promise2()).promisify)((_fs || _load_fs()).default.chmod);
const link = exports.link = (0, (_promise2 || _load_promise2()).promisify)((_fs || _load_fs()).default.link);
const glob = exports.glob = (0, (_promise2 || _load_promise2()).promisify)((_glob || _load_glob()).default);
exports.unlink = (_fsNormalized || _load_fsNormalized()).unlink;

// fs.copyFile uses the native file copying instructions on the system, performing much better
// than any JS-based solution and consumes fewer resources. Repeated testing to fine tune the
// concurrency level revealed 128 as the sweet spot on a quad-core, 16 CPU Intel system with SSD.

const CONCURRENT_QUEUE_ITEMS = (_fs || _load_fs()).default.copyFile ? 128 : 4;

const fsSymlink = (0, (_promise2 || _load_promise2()).promisify)((_fs || _load_fs()).default.symlink);
const invariant = require('invariant');
const stripBOM = require('strip-bom');

const noop = () => {};

function copy(src, dest, reporter) {
  return copyBulk([{ src, dest }], reporter);
}

function _readFile(loc, encoding) {
  return new Promise((resolve, reject) => {
    (_fs || _load_fs()).default.readFile(loc, encoding, function (err, content) {
      if (err) {
        reject(err);
      } else {
        resolve(content);
      }
    });
  });
}

function readFile(loc) {
  return _readFile(loc, 'utf8').then(normalizeOS);
}

function readFileRaw(loc) {
  return _readFile(loc, 'binary');
}

function normalizeOS(body) {
  return body.replace(/\r\n/g, '\n');
}

const cr = '\r'.charCodeAt(0);
const lf = '\n'.charCodeAt(0);