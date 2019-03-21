'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let publish = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, pkg, flags, dir) {
    let access = flags.access;

    // if no access level is provided, check package.json for `publishConfig.access`
    // see: https://docs.npmjs.com/files/package.json#publishconfig
    if (!access && pkg && pkg.publishConfig && pkg.publishConfig.access) {
      access = pkg.publishConfig.access;
    }

    // validate access argument
    if (access && access !== 'public' && access !== 'restricted') {
      throw new (_errors || _load_errors()).MessageError(config.reporter.lang('invalidAccess'));
    }

    // TODO this might modify package.json, do we need to reload it?
    yield config.executeLifecycleScript('prepublish');
    yield config.executeLifecycleScript('prepare');
    yield config.executeLifecycleScript('prepublishOnly');
    yield config.executeLifecycleScript('prepack');

    // get tarball stream
    const stat = yield (_fs || _load_fs()).lstat(dir);
    let stream;
    if (stat.isDirectory()) {
      stream = yield (0, (_pack || _load_pack()).pack)(config);
    } else if (stat.isFile()) {
      stream = fs2.createReadStream(dir);
    } else {
      throw new Error("Don't know how to handle this file type");
    }
    const buffer = yield new Promise(function (resolve, reject) {
      const data = [];
      invariant(stream, 'expected stream');
      stream.on('data', data.push.bind(data)).on('end', function () {
        return resolve(Buffer.concat(data));
      }).on('error', reject);
    });

    yield config.executeLifecycleScript('postpack');

    // copy normalized package and remove internal keys as they may be sensitive or yarn specific
    pkg = Object.assign({}, pkg);
    for (const key in pkg) {
      if (key[0] === '_') {
        delete pkg[key];
      }
    }

    const tag = flags.tag || 'latest';
    const tbName = `${pkg.name}-${pkg.version}.tgz`;
    const tbURI = `${pkg.name}/-/${tbName}`;

    // create body
    const root = {
      _id: pkg.name,
      access,
      name: pkg.name,
      description: pkg.description,
      'dist-tags': {
        [tag]: pkg.version
      },
      versions: {
        [pkg.version]: pkg
      },
      readme: pkg.readme || '',
      _attachments: {
        [tbName]: {
          content_type: 'application/octet-stream',
          data: buffer.toString('base64'),
          length: buffer.length
        }
      }
    };

    pkg._id = `${pkg.name}@${pkg.version}`;
    pkg.dist = pkg.dist || {};
    pkg.dist.shasum = crypto.createHash('sha1').update(buffer).digest('hex');
    pkg.dist.integrity = ssri.fromData(buffer).toString();

    const registry = String(config.getOption('registry'));
    pkg.dist.tarball = url.resolve(registry, tbURI).replace(/^https:\/\//, 'http://');

    // publish package
    try {
      yield config.registries.npm.request((_npmRegistry || _load_npmRegistry()).default.escapeName(pkg.name), {
        registry: pkg && pkg.publishConfig && pkg.publishConfig.registry,
        method: 'PUT',
        body: root
      });
    } catch (error) {
      throw new (_errors || _load_errors()).MessageError(config.reporter.lang('publishFail', error.message));
    }

    yield config.executeLifecycleScript('publish');
    yield config.executeLifecycleScript('postpublish');
  });

  return function publish(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
})();

let run = exports.run = (() => {
  var _ref2 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    // validate arguments
    const dir = args[0] ? (_path || _load_path()).default.resolve(config.cwd, args[0]) : config.cwd;
    if (args.length > 1) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('tooManyArguments', 1));
    }
    if (!(yield (_fs || _load_fs()).exists(dir))) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('unknownFolderOrTarball'));
    }

    const stat = yield (_fs || _load_fs()).lstat(dir);
    let publishPath = dir;
    if (stat.isDirectory()) {
      config.cwd = (_path || _load_path()).default.resolve(dir);
      publishPath = config.cwd;
    }

    // validate package fields that are required for publishing
    // $FlowFixMe
    const pkg = yield config.readRootManifest();
    if (pkg.private) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('publishPrivate'));
    }
    if (!pkg.name) {
      throw new (_errors || _load_errors()).MessageError(reporter.lang('noName'));
    }

    let registry = '';

    if (pkg && pkg.publishConfig && pkg.publishConfig.registry) {
      registry = pkg.publishConfig.registry;
    }

    reporter.step(1, 4, reporter.lang('bumpingVersion'));
    const commitVersion = yield (0, (_version || _load_version()).setVersion)(config, reporter, flags, [], false);

    //
    reporter.step(2, 4, reporter.lang('loggingIn'));
    const revoke = yield (0, (_login || _load_login()).getToken)(config, reporter, pkg.name, flags, registry);

    //
    reporter.step(3, 4, reporter.lang('publishing'));
    yield publish(config, pkg, flags, publishPath);
    yield commitVersion();
    reporter.success(reporter.lang('published'));

    //
    reporter.step(4, 4, reporter.lang('revokingToken'));
    yield revoke();
  });

  return function run(_x5, _x6, _x7, _x8) {
    return _ref2.apply(this, arguments);
  };
})();

exports.setFlags = setFlags;
exports.hasWrapper = hasWrapper;

var _npmRegistry;

function _load_npmRegistry() {
  return _npmRegistry = _interopRequireDefault(require('../../registries/npm-registry.js'));
}

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _version;

function _load_version() {
  return _version = require('./version.js');
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

var _pack;

function _load_pack() {
  return _pack = require('./pack.js');
}

var _login;

function _load_login() {
  return _login = require('./login.js');
}

var _path;

function _load_path() {
  return _path = _interopRequireDefault(require('path'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');

const crypto = require('crypto');
const url = require('url');
const fs2 = require('fs');
const ssri = require('ssri');

function setFlags(commander) {
  (0, (_version || _load_version()).setFlags)(commander);
  commander.description('Publishes a package to the npm registry.');
  commander.usage('publish [<tarball>|<folder>] [--tag <tag>] [--access <public|restricted>]');
  commander.option('--access [access]', 'access');
  commander.option('--tag [tag]', 'tag');
}

function hasWrapper(commander, args) {
  return true;
}