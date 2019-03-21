'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = exports.getToken = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let getCredentials = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter) {
    var _config$registries$ya = config.registries.yarn.config;
    let username = _config$registries$ya.username,
        email = _config$registries$ya.email;


    if (username) {
      reporter.info(`${reporter.lang('npmUsername')}: ${username}`);
    } else {
      username = yield reporter.question(reporter.lang('npmUsername'));
      if (!username) {
        return null;
      }
    }

    if (email) {
      reporter.info(`${reporter.lang('npmEmail')}: ${email}`);
    } else {
      email = yield reporter.question(reporter.lang('npmEmail'));
      if (!email) {
        return null;
      }
    }

    yield config.registries.yarn.saveHomeConfig({ username, email });

    return { username, email };
  });

  return function getCredentials(_x, _x2) {
    return _ref.apply(this, arguments);
  };
})();

let getToken = exports.getToken = (() => {
  var _ref2 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, name = '', flags = {}, registry = '') {
    const auth = registry ? config.registries.npm.getAuthByRegistry(registry) : config.registries.npm.getAuth(name);

    if (config.otp) {
      config.registries.npm.setOtp(config.otp);
    }

    if (auth) {
      config.registries.npm.setToken(auth);
      return function revoke() {
        reporter.info(reporter.lang('notRevokingConfigToken'));
        return Promise.resolve();
      };
    }

    const env = process.env.YARN_AUTH_TOKEN || process.env.NPM_AUTH_TOKEN;
    if (env) {
      config.registries.npm.setToken(`Bearer ${env}`);
      return function revoke() {
        reporter.info(reporter.lang('notRevokingEnvToken'));
        return Promise.resolve();
      };
    }

    // make sure we're not running in non-interactive mode before asking for login
    if (flags.nonInteractive || config.nonInteractive) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('nonInteractiveNoToken'));
    }

    //
    const creds = yield getCredentials(config, reporter);
    if (!creds) {
      reporter.warn(reporter.lang('loginAsPublic'));
      return function revoke() {
        reporter.info(reporter.lang('noTokenToRevoke'));
        return Promise.resolve();
      };
    }

    const username = creds.username,
          email = creds.email;

    const password = yield reporter.question(reporter.lang('npmPassword'), {
      password: true,
      required: true
    });

    //
    const userobj = {
      _id: `org.couchdb.user:${username}`,
      name: username,
      password,
      email,
      type: 'user',
      roles: [],
      date: new Date().toISOString()
    };

    //
    const res = yield config.registries.npm.request(`-/user/org.couchdb.user:${encodeURIComponent(username)}`, {
      method: 'PUT',
      body: userobj,
      auth: { username, password, email }
    });

    if (res && res.ok) {
      reporter.success(reporter.lang('loggedIn'));

      const token = res.token;
      config.registries.npm.setToken(`Bearer ${token}`);

      return (() => {
        var _ref3 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
          reporter.success(reporter.lang('revokedToken'));
          yield config.registries.npm.request(`-/user/token/${token}`, {
            method: 'DELETE'
          });
        });

        function revoke() {
          return _ref3.apply(this, arguments);
        }

        return revoke;
      })();
    } else {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('incorrectCredentials'));
    }
  });

  return function getToken(_x3, _x4) {
    return _ref2.apply(this, arguments);
  };
})();

let run = exports.run = (() => {
  var _ref4 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    yield getCredentials(config, reporter);
  });

  return function run(_x5, _x6, _x7, _x8) {
    return _ref4.apply(this, arguments);
  };
})();

exports.getOneTimePassword = getOneTimePassword;
exports.hasWrapper = hasWrapper;
exports.setFlags = setFlags;

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getOneTimePassword(reporter) {
  return reporter.question(reporter.lang('npmOneTimePassword'));
}

function hasWrapper(commander, args) {
  return true;
}

function setFlags(commander) {
  commander.description('Stores registry username and email.');
}