'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.examples = exports.hasWrapper = exports.run = exports.mutate = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let mutate = exports.mutate = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (args, config, reporter, buildMessages, mutator) {
    if (args.length !== 2 && args.length !== 1) {
      return false;
    }

    const username = args.shift();
    const name = yield (0, (_tag || _load_tag()).getName)(args, config);
    if (!(0, (_validate || _load_validate()).isValidPackageName)(name)) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('invalidPackageName'));
    }

    const msgs = buildMessages(username, name);
    reporter.step(1, 3, reporter.lang('loggingIn'));
    const revoke = yield (0, (_login || _load_login()).getToken)(config, reporter, name);

    reporter.step(2, 3, msgs.info);
    const user = yield config.registries.npm.request(`-/user/org.couchdb.user:${username}`);
    let error = false;
    if (user) {
      // get package
      const pkg = yield config.registries.npm.request((_npmRegistry || _load_npmRegistry()).default.escapeName(name));
      if (pkg) {
        pkg.maintainers = pkg.maintainers || [];
        error = mutator({ name: user.name, email: user.email }, pkg);
      } else {
        error = true;
        reporter.error(reporter.lang('unknownPackage', name));
      }

      // update package
      if (pkg && !error) {
        const res = yield config.registries.npm.request(`${(_npmRegistry || _load_npmRegistry()).default.escapeName(name)}/-rev/${pkg._rev}`, {
          method: 'PUT',
          body: {
            _id: pkg._id,
            _rev: pkg._rev,
            maintainers: pkg.maintainers
          }
        });

        if (res != null && res.success) {
          reporter.success(msgs.success);
        } else {
          error = true;
          reporter.error(msgs.error);
        }
      }
    } else {
      error = true;
      reporter.error(reporter.lang('unknownUser', username));
    }

    reporter.step(3, 3, reporter.lang('revokingToken'));
    yield revoke();

    if (error) {
      throw new Error();
    } else {
      return true;
    }
  });

  return function mutate(_x, _x2, _x3, _x4, _x5) {
    return _ref.apply(this, arguments);
  };
})();

let list = (() => {
  var _ref2 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    if (args.length > 1) {
      return false;
    }
    const name = yield (0, (_tag || _load_tag()).getName)(args, config);
    reporter.step(1, 1, reporter.lang('ownerGetting', name));
    const pkg = yield config.registries.npm.request(name, { unfiltered: true });
    if (pkg) {
      const owners = pkg.maintainers;
      if (!owners || !owners.length) {
        reporter.warn(reporter.lang('ownerNone'));
      } else {
        for (var _iterator = owners, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
          var _ref3;

          if (_isArray) {
            if (_i >= _iterator.length) break;
            _ref3 = _iterator[_i++];
          } else {
            _i = _iterator.next();
            if (_i.done) break;
            _ref3 = _i.value;
          }

          const owner = _ref3;

          reporter.info(`${owner.name} <${owner.email}>`);
        }
      }
    } else {
      reporter.error(reporter.lang('ownerGettingFailed'));
    }

    if (pkg) {
      return true;
    } else {
      throw new Error();
    }
  });

  return function list(_x6, _x7, _x8, _x9) {
    return _ref2.apply(this, arguments);
  };
})();

exports.setFlags = setFlags;

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _buildSubCommands2;

function _load_buildSubCommands() {
  return _buildSubCommands2 = _interopRequireDefault(require('./_build-sub-commands.js'));
}

var _validate;

function _load_validate() {
  return _validate = require('../../util/normalize-manifest/validate.js');
}

var _tag;

function _load_tag() {
  return _tag = require('./tag.js');
}

var _login;

function _load_login() {
  return _login = require('./login.js');
}

var _npmRegistry;

function _load_npmRegistry() {
  return _npmRegistry = _interopRequireDefault(require('../../registries/npm-registry.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function remove(config, reporter, flags, args) {
  return mutate(args, config, reporter, (username, name) => ({
    info: reporter.lang('ownerRemoving', username, name),
    success: reporter.lang('ownerRemoved'),
    error: reporter.lang('ownerRemoveError')
  }), (user, pkg) => {
    let found = false;

    pkg.maintainers = pkg.maintainers.filter(o => {
      const match = o.name === user.name;
      found = found || match;
      return !match;
    });

    if (!found) {
      reporter.error(reporter.lang('userNotAnOwner', user.name));
    }

    return found;
  });
}

function setFlags(commander) {
  commander.description('Manages package owners.');
}

var _buildSubCommands = (0, (_buildSubCommands2 || _load_buildSubCommands()).default)('owner', {
  add(config, reporter, flags, args) {
    return mutate(args, config, reporter, (username, name) => ({
      info: reporter.lang('ownerAdding', username, name),
      success: reporter.lang('ownerAdded'),
      error: reporter.lang('ownerAddingFailed')
    }), (user, pkg) => {
      for (var _iterator2 = pkg.maintainers, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
        var _ref4;

        if (_isArray2) {
          if (_i2 >= _iterator2.length) break;
          _ref4 = _iterator2[_i2++];
        } else {
          _i2 = _iterator2.next();
          if (_i2.done) break;
          _ref4 = _i2.value;
        }

        const owner = _ref4;

        if (owner.name === user) {
          reporter.error(reporter.lang('ownerAlready'));
          return true;
        }
      }

      pkg.maintainers.push(user);

      return false;
    });
  },

  rm(config, reporter, flags, args) {
    reporter.warn(`\`yarn owner rm\` is deprecated. Please use \`yarn owner remove\`.`);
    return remove(config, reporter, flags, args);
  },

  remove(config, reporter, flags, args) {
    return remove(config, reporter, flags, args);
  },

  ls(config, reporter, flags, args) {
    reporter.warn(`\`yarn owner ls\` is deprecated. Please use \`yarn owner list\`.`);
    return list(config, reporter, flags, args);
  },

  list(config, reporter, flags, args) {
    return list(config, reporter, flags, args);
  }
}, ['add <user> [[<@scope>/]<pkg>]', 'remove <user> [[<@scope>/]<pkg>]', 'list [<@scope>/]<pkg>']);

const run = _buildSubCommands.run,
      hasWrapper = _buildSubCommands.hasWrapper,
      examples = _buildSubCommands.examples;
exports.run = run;
exports.hasWrapper = hasWrapper;
exports.examples = examples;