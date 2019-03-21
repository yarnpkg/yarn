'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parseRefs = exports.resolveVersion = exports.isCommitSha = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _misc;

function _load_misc() {
  return _misc = require('../misc.js');
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const semver = require('semver');

const REF_PREFIX = 'refs/';
const REF_TAG_PREFIX = 'refs/tags/';
const REF_BRANCH_PREFIX = 'refs/heads/';
const REF_PR_PREFIX = 'refs/pull/';

// This regex is designed to match output from git of the style:
//   ebeb6eafceb61dd08441ffe086c77eb472842494  refs/tags/v0.21.0
// and extract the hash and ref name as capture groups
const GIT_REF_LINE_REGEXP = /^([a-fA-F0-9]+)\s+(refs\/(?:tags|heads|pull|remotes)\/.*)$/;

const COMMIT_SHA_REGEXP = /^[a-f0-9]{5,40}$/;
const REF_NAME_REGEXP = /^refs\/(tags|heads)\/(.+)$/;

const isCommitSha = exports.isCommitSha = target => COMMIT_SHA_REGEXP.test(target);

const tryVersionAsGitCommit = ({ version, refs, git }) => {
  const lowercaseVersion = version.toLowerCase();
  if (!isCommitSha(lowercaseVersion)) {
    return Promise.resolve(null);
  }
  for (var _iterator = refs.entries(), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
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
    const ref = _ref[0];
    const sha = _ref[1];

    if (sha.startsWith(lowercaseVersion)) {
      return Promise.resolve({ sha, ref });
    }
  }
  return git.resolveCommit(lowercaseVersion);
};

const tryEmptyVersionAsDefaultBranch = ({ version, git }) => version.trim() === '' ? git.resolveDefaultBranch() : Promise.resolve(null);

const tryWildcardVersionAsDefaultBranch = ({ version, git }) => version === '*' ? git.resolveDefaultBranch() : Promise.resolve(null);

const tryRef = (refs, ref) => {
  const sha = refs.get(ref);
  return sha ? { sha, ref } : null;
};

const tryVersionAsFullRef = ({ version, refs }) => version.startsWith('refs/') ? tryRef(refs, version) : null;

const tryVersionAsTagName = ({ version, refs }) => tryRef(refs, `${REF_TAG_PREFIX}${version}`);

const tryVersionAsPullRequestNo = ({ version, refs }) => tryRef(refs, `${REF_PR_PREFIX}${version}`);

const tryVersionAsBranchName = ({ version, refs }) => tryRef(refs, `${REF_BRANCH_PREFIX}${version}`);

const tryVersionAsDirectRef = ({ version, refs }) => tryRef(refs, `${REF_PREFIX}${version}`);

const computeSemverNames = ({ config, refs }) => {
  const names = {
    tags: [],
    heads: []
  };
  for (var _iterator2 = refs.keys(), _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
    var _ref3;

    if (_isArray2) {
      if (_i2 >= _iterator2.length) break;
      _ref3 = _iterator2[_i2++];
    } else {
      _i2 = _iterator2.next();
      if (_i2.done) break;
      _ref3 = _i2.value;
    }

    const ref = _ref3;

    const match = REF_NAME_REGEXP.exec(ref);
    if (!match) {
      continue;
    }
    const type = match[1],
          name = match[2];

    if (semver.valid(name, config.looseSemver)) {
      names[type].push(name);
    }
  }
  return names;
};

const findSemver = (version, config, namesList) => config.resolveConstraints(namesList, version);

const tryVersionAsTagSemver = (() => {
  var _ref4 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* ({ version, config, refs }, names) {
    const result = yield findSemver(version.replace(/^semver:/, ''), config, names.tags);
    return result ? tryRef(refs, `${REF_TAG_PREFIX}${result}`) : null;
  });

  return function tryVersionAsTagSemver(_x, _x2) {
    return _ref4.apply(this, arguments);
  };
})();

const tryVersionAsBranchSemver = (() => {
  var _ref5 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* ({ version, config, refs }, names) {
    const result = yield findSemver(version.replace(/^semver:/, ''), config, names.heads);
    return result ? tryRef(refs, `${REF_BRANCH_PREFIX}${result}`) : null;
  });

  return function tryVersionAsBranchSemver(_x3, _x4) {
    return _ref5.apply(this, arguments);
  };
})();

const tryVersionAsSemverRange = (() => {
  var _ref6 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (options) {
    const names = computeSemverNames(options);
    return (yield tryVersionAsTagSemver(options, names)) || tryVersionAsBranchSemver(options, names);
  });

  return function tryVersionAsSemverRange(_x5) {
    return _ref6.apply(this, arguments);
  };
})();

const VERSION_RESOLUTION_STEPS = [tryEmptyVersionAsDefaultBranch, tryVersionAsGitCommit, tryVersionAsFullRef, tryVersionAsTagName, tryVersionAsPullRequestNo, tryVersionAsBranchName, tryVersionAsSemverRange, tryWildcardVersionAsDefaultBranch, tryVersionAsDirectRef];

/**
 * Resolve a git-url hash (version) to a git commit sha and branch/tag ref
 * Returns null if the version cannot be resolved to any commit
 */

const resolveVersion = exports.resolveVersion = (() => {
  var _ref7 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (options) {
    for (var _iterator3 = VERSION_RESOLUTION_STEPS, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
      var _ref8;

      if (_isArray3) {
        if (_i3 >= _iterator3.length) break;
        _ref8 = _iterator3[_i3++];
      } else {
        _i3 = _iterator3.next();
        if (_i3.done) break;
        _ref8 = _i3.value;
      }

      const testFunction = _ref8;

      const result = yield testFunction(options);
      if (result !== null) {
        return result;
      }
    }
    return null;
  });

  return function resolveVersion(_x6) {
    return _ref7.apply(this, arguments);
  };
})();

/**
 * Parse Git ref lines into hash of ref names to SHA hashes
 */

const parseRefs = exports.parseRefs = stdout => {
  // store references
  const refs = new Map();

  // line delimited
  const refLines = stdout.split('\n');

  for (var _iterator4 = refLines, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
    var _ref9;

    if (_isArray4) {
      if (_i4 >= _iterator4.length) break;
      _ref9 = _iterator4[_i4++];
    } else {
      _i4 = _iterator4.next();
      if (_i4.done) break;
      _ref9 = _i4.value;
    }

    const line = _ref9;

    const match = GIT_REF_LINE_REGEXP.exec(line);

    if (match) {
      const sha = match[1],
            tagName = match[2];

      // As documented in gitrevisions:
      //   https://www.kernel.org/pub/software/scm/git/docs/gitrevisions.html#_specifying_revisions
      // "A suffix ^ followed by an empty brace pair means the object could be a tag,
      //   and dereference the tag recursively until a non-tag object is found."
      // In other words, the hash without ^{} is the hash of the tag,
      //   and the hash with ^{} is the hash of the commit at which the tag was made.

      const name = (0, (_misc || _load_misc()).removeSuffix)(tagName, '^{}');

      refs.set(name, sha);
    }
  }

  return refs;
};