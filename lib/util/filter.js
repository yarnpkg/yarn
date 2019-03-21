'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.sortFilter = sortFilter;
exports.matchesFilter = matchesFilter;
exports.ignoreLinesToRegex = ignoreLinesToRegex;
exports.filterOverridenGitignores = filterOverridenGitignores;

var _misc;

function _load_misc() {
  return _misc = require('./misc.js');
}

const mm = require('micromatch');
const path = require('path');

const WHITESPACE_RE = /^\s+$/;

function sortFilter(files, filters, keepFiles = new Set(), possibleKeepFiles = new Set(), ignoreFiles = new Set()) {
  for (var _iterator = files, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
    var _ref;

    if (_isArray) {
      if (_i >= _iterator.length) break;
      _ref = _iterator[_i++];
    } else {
      _i = _iterator.next();
      if (_i.done) break;
      _ref = _i.value;
    }

    const file = _ref;

    let keep = false;

    // always keep a file if a ! pattern matches it
    for (var _iterator5 = filters, _isArray5 = Array.isArray(_iterator5), _i5 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
      var _ref5;

      if (_isArray5) {
        if (_i5 >= _iterator5.length) break;
        _ref5 = _iterator5[_i5++];
      } else {
        _i5 = _iterator5.next();
        if (_i5.done) break;
        _ref5 = _i5.value;
      }

      const filter = _ref5;

      if (filter.isNegation && matchesFilter(filter, file.basename, file.relative)) {
        keep = true;
        break;
      }
    }

    //
    if (keep) {
      keepFiles.add(file.relative);
      continue;
    }

    // otherwise don't keep it if a pattern matches it
    keep = true;
    for (var _iterator6 = filters, _isArray6 = Array.isArray(_iterator6), _i6 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
      var _ref6;

      if (_isArray6) {
        if (_i6 >= _iterator6.length) break;
        _ref6 = _iterator6[_i6++];
      } else {
        _i6 = _iterator6.next();
        if (_i6.done) break;
        _ref6 = _i6.value;
      }

      const filter = _ref6;

      if (!filter.isNegation && matchesFilter(filter, file.basename, file.relative)) {
        keep = false;
        break;
      }
    }

    if (keep) {
      possibleKeepFiles.add(file.relative);
    } else {
      ignoreFiles.add(file.relative);
    }
  }

  // exclude file
  for (var _iterator2 = possibleKeepFiles, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
    var _ref2;

    if (_isArray2) {
      if (_i2 >= _iterator2.length) break;
      _ref2 = _iterator2[_i2++];
    } else {
      _i2 = _iterator2.next();
      if (_i2.done) break;
      _ref2 = _i2.value;
    }

    const file = _ref2;

    const parts = path.dirname(file).split(path.sep);

    while (parts.length) {
      const folder = parts.join(path.sep);
      if (ignoreFiles.has(folder)) {
        ignoreFiles.add(file);
        break;
      }
      parts.pop();
    }
  }

  //
  for (var _iterator3 = possibleKeepFiles, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
    var _ref3;

    if (_isArray3) {
      if (_i3 >= _iterator3.length) break;
      _ref3 = _iterator3[_i3++];
    } else {
      _i3 = _iterator3.next();
      if (_i3.done) break;
      _ref3 = _i3.value;
    }

    const file = _ref3;

    if (!ignoreFiles.has(file)) {
      keepFiles.add(file);
    }
  }

  //
  for (var _iterator4 = keepFiles, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
    var _ref4;

    if (_isArray4) {
      if (_i4 >= _iterator4.length) break;
      _ref4 = _iterator4[_i4++];
    } else {
      _i4 = _iterator4.next();
      if (_i4.done) break;
      _ref4 = _i4.value;
    }

    const file = _ref4;

    const parts = path.dirname(file).split(path.sep);

    while (parts.length) {
      // deregister this folder from being ignored, any files inside
      // will still be marked as ignored
      ignoreFiles.delete(parts.join(path.sep));
      parts.pop();
    }
  }

  return { ignoreFiles, keepFiles };
}

function matchesFilter(filter, basename, loc) {
  let filterByBasename = true;
  if (filter.base && filter.base !== '.') {
    loc = path.relative(filter.base, loc);
    filterByBasename = false;
  }
  // the micromatch regex expects unix path separators
  loc = loc.replace(/\\/g, '/');

  return filter.regex.test(loc) || filter.regex.test(`/${loc}`) || filterByBasename && filter.regex.test(basename) || mm.isMatch(loc, filter.pattern);
}

function ignoreLinesToRegex(lines, base = '.') {
  return lines
  // create regex
  .map(line => {
    // remove empty lines, comments, etc
    if (line === '' || line === '!' || line[0] === '#' || WHITESPACE_RE.test(line)) {
      return null;
    }

    let pattern = line;
    let isNegation = false;

    // hide the fact that it's a negation from minimatch since we'll handle this specifically
    // ourselves
    if (pattern[0] === '!') {
      isNegation = true;
      pattern = pattern.slice(1);
    }

    // remove trailing slash
    pattern = (0, (_misc || _load_misc()).removeSuffix)(pattern, '/');

    const regex = mm.makeRe(pattern.trim(), { dot: true, nocase: true });

    if (regex) {
      return {
        base,
        isNegation,
        pattern,
        regex
      };
    } else {
      return null;
    }
  }).filter(Boolean);
}

function filterOverridenGitignores(files) {
  const IGNORE_FILENAMES = ['.yarnignore', '.npmignore', '.gitignore'];
  const GITIGNORE_NAME = IGNORE_FILENAMES[2];
  return files.filter(file => IGNORE_FILENAMES.indexOf(file.basename) > -1).reduce((acc, file) => {
    if (file.basename !== GITIGNORE_NAME) {
      return [...acc, file];
    } else {
      //don't include .gitignore if .npmignore or .yarnignore are present
      const dir = path.dirname(file.absolute);
      const higherPriorityIgnoreFilePaths = [path.join(dir, IGNORE_FILENAMES[0]), path.join(dir, IGNORE_FILENAMES[1])];
      const hasHigherPriorityFiles = files.find(file => higherPriorityIgnoreFilePaths.indexOf(path.normalize(file.absolute)) > -1);
      if (!hasHigherPriorityFiles) {
        return [...acc, file];
      }
    }
    return acc;
  }, []);
}