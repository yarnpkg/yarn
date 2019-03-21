'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getGitConfigInfo = exports.run = exports.shouldRunInCurrentCwd = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let run = exports.run = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    const manifests = yield config.getRootManifests();

    let repository = {};
    const author = {
      name: config.getOption('init-author-name'),
      email: config.getOption('init-author-email'),
      url: config.getOption('init-author-url')
    };
    if (yield (_fs || _load_fs()).exists(path.join(config.cwd, '.git'))) {
      // get git origin of the cwd
      try {
        repository = {
          type: 'git',
          url: yield (_child || _load_child()).spawn('git', ['config', 'remote.origin.url'], {
            cwd: config.cwd
          })
        };
      } catch (ex) {
        // Ignore - Git repo may not have an origin URL yet (eg. if it only exists locally)
      }

      if (author.name === undefined) {
        author.name = yield getGitConfigInfo('user.name');
      }

      if (author.email === undefined) {
        author.email = yield getGitConfigInfo('user.email');
      }
    }

    const keys = [{
      key: 'name',
      question: 'name',
      default: path.basename(config.cwd),
      validation: (_validate || _load_validate()).isValidPackageName,
      validationError: 'invalidPackageName'
    }, {
      key: 'version',
      question: 'version',
      default: String(config.getOption('init-version'))
    }, {
      key: 'description',
      question: 'description',
      default: ''
    }, {
      key: 'main',
      question: 'entry point',
      default: 'index.js'
    }, {
      key: 'repository',
      question: 'repository url',
      default: (0, (_util || _load_util()).extractRepositoryUrl)(repository)
    }, {
      key: 'author',
      question: 'author',
      default: (0, (_util || _load_util()).stringifyPerson)(author)
    }, {
      key: 'license',
      question: 'license',
      default: String(config.getOption('init-license'))
    }, {
      key: 'private',
      question: 'private',
      default: config.getOption('init-private') || '',
      inputFormatter: yn
    }];

    // get answers
    const pkg = {};
    for (var _iterator = keys, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref2;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref2 = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref2 = _i.value;
      }

      const entry = _ref2;
      const yes = flags.yes,
            privateFlag = flags.private;
      const manifestKey = entry.key;
      let question = entry.question,
          def = entry.default;


      for (var _iterator4 = (_index || _load_index()).registryNames, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
        var _ref5;

        if (_isArray4) {
          if (_i4 >= _iterator4.length) break;
          _ref5 = _iterator4[_i4++];
        } else {
          _i4 = _iterator4.next();
          if (_i4.done) break;
          _ref5 = _i4.value;
        }

        const registryName = _ref5;
        const object = manifests[registryName].object;

        let val = objectPath.get(object, manifestKey);
        if (!val) {
          break;
        }
        if (typeof val === 'object') {
          if (manifestKey === 'author') {
            val = (0, (_util || _load_util()).stringifyPerson)(val);
          } else if (manifestKey === 'repository') {
            val = (0, (_util || _load_util()).extractRepositoryUrl)(val);
          }
        }
        def = val;
      }

      if (manifestKey === 'private' && privateFlag) {
        def = true;
      }

      if (def) {
        question += ` (${String(def)})`;
      }

      let answer;
      let validAnswer = false;

      if (yes) {
        answer = def;
      } else {
        // loop until a valid answer is provided, if validation is on entry
        if (entry.validation) {
          while (!validAnswer) {
            answer = (yield reporter.question(question)) || def;
            // validate answer
            if (entry.validation(String(answer))) {
              validAnswer = true;
            } else {
              reporter.error(reporter.lang('invalidPackageName'));
            }
          }
        } else {
          answer = (yield reporter.question(question)) || def;
        }
      }

      if (answer) {
        if (entry.inputFormatter) {
          answer = entry.inputFormatter(answer);
        }
        objectPath.set(pkg, manifestKey, answer);
      }
    }

    if (pkg.repository && (_githubResolver || _load_githubResolver()).default.isVersion(pkg.repository)) {
      pkg.repository = `https://github.com/${pkg.repository}`;
    }

    // save answers
    const targetManifests = [];
    for (var _iterator2 = (_index || _load_index()).registryNames, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
      var _ref3;

      if (_isArray2) {
        if (_i2 >= _iterator2.length) break;
        _ref3 = _iterator2[_i2++];
      } else {
        _i2 = _iterator2.next();
        if (_i2.done) break;
        _ref3 = _i2.value;
      }

      const registryName = _ref3;

      const info = manifests[registryName];
      if (info.exists) {
        targetManifests.push(info);
      }
    }
    if (!targetManifests.length) {
      targetManifests.push(manifests.npm);
    }
    for (var _iterator3 = targetManifests, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
      var _ref4;

      if (_isArray3) {
        if (_i3 >= _iterator3.length) break;
        _ref4 = _iterator3[_i3++];
      } else {
        _i3 = _iterator3.next();
        if (_i3.done) break;
        _ref4 = _i3.value;
      }

      const targetManifest = _ref4;

      Object.assign(targetManifest.object, pkg);
      reporter.success(`Saved ${path.basename(targetManifest.loc)}`);
    }

    yield config.saveRootManifests(manifests);
  });

  return function run(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

let getGitConfigInfo = exports.getGitConfigInfo = (() => {
  var _ref6 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (credential, spawn = (_child || _load_child()).spawn) {
    try {
      // try to get author default based on git config
      return yield spawn('git', ['config', credential]);
    } catch (e) {
      return '';
    }
  });

  return function getGitConfigInfo(_x5) {
    return _ref6.apply(this, arguments);
  };
})();

exports.setFlags = setFlags;
exports.hasWrapper = hasWrapper;

var _util;

function _load_util() {
  return _util = require('../../util/normalize-manifest/util.js');
}

var _index;

function _load_index() {
  return _index = require('../../registries/index.js');
}

var _githubResolver;

function _load_githubResolver() {
  return _githubResolver = _interopRequireDefault(require('../../resolvers/exotics/github-resolver.js'));
}

var _child;

function _load_child() {
  return _child = _interopRequireWildcard(require('../../util/child.js'));
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

var _validate;

function _load_validate() {
  return _validate = _interopRequireWildcard(require('../../util/normalize-manifest/validate.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const objectPath = require('object-path');
const path = require('path');
const yn = require('yn');

function setFlags(commander) {
  commander.description('Interactively creates or updates a package.json file.');
  commander.option('-y, --yes', 'use default options');
  commander.option('-p, --private', 'use default options and private true');
}

function hasWrapper(commander, args) {
  return true;
}

const shouldRunInCurrentCwd = exports.shouldRunInCurrentCwd = true;