'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.examples = exports.run = undefined;

var _extends2;

function _load_extends() {
  return _extends2 = _interopRequireDefault(require('babel-runtime/helpers/extends'));
}

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let getManifests = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, flags) {
    const lockfile = yield (_lockfile || _load_lockfile()).default.fromDirectory(config.cwd);
    const install = new (_install || _load_install()).Install((0, (_extends2 || _load_extends()).default)({ skipIntegrityCheck: true }, flags), config, new (_baseReporter || _load_baseReporter()).default(), lockfile);
    yield install.hydrate(true);

    let manifests = install.resolver.getManifests();

    // sort by name
    manifests = manifests.sort(function (a, b) {
      if (!a.name && !b.name) {
        return 0;
      }

      if (!a.name) {
        return 1;
      }

      if (!b.name) {
        return -1;
      }

      return a.name.localeCompare(b.name);
    });

    // filter ignored manifests
    manifests = manifests.filter(function (manifest) {
      const ref = manifest._reference;
      return !!ref && !ref.ignore;
    });

    return manifests;
  });

  return function getManifests(_x, _x2) {
    return _ref.apply(this, arguments);
  };
})();

let list = (() => {
  var _ref2 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    const manifests = yield getManifests(config, flags);
    const manifestsByLicense = new Map();

    for (var _iterator = manifests, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref4;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref4 = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref4 = _i.value;
      }

      const _ref3 = _ref4;
      const name = _ref3.name,
            version = _ref3.version,
            license = _ref3.license,
            repository = _ref3.repository,
            homepage = _ref3.homepage,
            author = _ref3.author;

      const licenseKey = license || 'UNKNOWN';
      const url = repository ? repository.url : homepage;
      const vendorUrl = homepage || author && author.url;
      const vendorName = author && author.name;

      if (!manifestsByLicense.has(licenseKey)) {
        manifestsByLicense.set(licenseKey, new Map());
      }

      const byLicense = manifestsByLicense.get(licenseKey);
      invariant(byLicense, 'expected value');
      byLicense.set(`${name}@${version}`, {
        name,
        version,
        url,
        vendorUrl,
        vendorName
      });
    }

    if (flags.json) {
      const body = [];

      manifestsByLicense.forEach(function (license, licenseKey) {
        license.forEach(function ({ name, version, url, vendorUrl, vendorName }) {
          body.push([name, version, licenseKey, url || 'Unknown', vendorUrl || 'Unknown', vendorName || 'Unknown']);
        });
      });

      reporter.table(['Name', 'Version', 'License', 'URL', 'VendorUrl', 'VendorName'], body);
    } else {
      const trees = [];

      manifestsByLicense.forEach(function (license, licenseKey) {
        const licenseTree = [];

        license.forEach(function ({ name, version, url, vendorUrl, vendorName }) {
          const children = [];

          if (url) {
            children.push({ name: `${reporter.format.bold('URL:')} ${url}` });
          }

          if (vendorUrl) {
            children.push({ name: `${reporter.format.bold('VendorUrl:')} ${vendorUrl}` });
          }

          if (vendorName) {
            children.push({ name: `${reporter.format.bold('VendorName:')} ${vendorName}` });
          }

          licenseTree.push({
            name: `${name}@${version}`,
            children
          });
        });

        trees.push({
          name: licenseKey,
          children: licenseTree
        });
      });

      reporter.tree('licenses', trees, { force: true });
    }
  });

  return function list(_x3, _x4, _x5, _x6) {
    return _ref2.apply(this, arguments);
  };
})();

exports.hasWrapper = hasWrapper;
exports.setFlags = setFlags;

var _baseReporter;

function _load_baseReporter() {
  return _baseReporter = _interopRequireDefault(require('../../reporters/base-reporter.js'));
}

var _install;

function _load_install() {
  return _install = require('./install.js');
}

var _lockfile;

function _load_lockfile() {
  return _lockfile = _interopRequireDefault(require('../../lockfile'));
}

var _buildSubCommands2;

function _load_buildSubCommands() {
  return _buildSubCommands2 = _interopRequireDefault(require('./_build-sub-commands.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');

function hasWrapper(flags, args) {
  return args[0] != 'generate-disclaimer';
}

function setFlags(commander) {
  commander.description('Lists licenses for installed packages.');
}

var _buildSubCommands = (0, (_buildSubCommands2 || _load_buildSubCommands()).default)('licenses', {
  ls(config, reporter, flags, args) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      reporter.warn(`\`yarn licenses ls\` is deprecated. Please use \`yarn licenses list\`.`);
      yield list(config, reporter, flags, args);
    })();
  },

  list(config, reporter, flags, args) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      yield list(config, reporter, flags, args);
    })();
  },

  generateDisclaimer(config, reporter, flags, args) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      /* eslint-disable no-console */

      // `reporter.log` dumps a bunch of ANSI escapes to clear the current line and
      // is for abstracting the console output so it can be consumed by other tools
      // (JSON output being the primary one). This command is only for text consumption
      // and you should just be dumping it to a TXT file. Using a reporter here has the
      // potential to mess up the output since it might print ansi escapes.
      const manifests = yield getManifests(config, flags);
      const manifest = yield config.readRootManifest();

      // Create a map of license text to manifest so that packages with exactly
      // the same license text are grouped together.
      const manifestsByLicense = new Map();
      for (var _iterator2 = manifests, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
        var _ref5;

        if (_isArray2) {
          if (_i2 >= _iterator2.length) break;
          _ref5 = _iterator2[_i2++];
        } else {
          _i2 = _iterator2.next();
          if (_i2.done) break;
          _ref5 = _i2.value;
        }

        const manifest = _ref5;
        const licenseText = manifest.licenseText,
              noticeText = manifest.noticeText;

        let licenseKey;
        if (!licenseText) {
          continue;
        }

        if (!noticeText) {
          licenseKey = licenseText;
        } else {
          licenseKey = `${licenseText}\n\nNOTICE\n\n${noticeText}`;
        }

        if (!manifestsByLicense.has(licenseKey)) {
          manifestsByLicense.set(licenseKey, new Map());
        }

        const byLicense = manifestsByLicense.get(licenseKey);
        invariant(byLicense, 'expected value');
        byLicense.set(manifest.name, manifest);
      }

      console.log('THE FOLLOWING SETS FORTH ATTRIBUTION NOTICES FOR THIRD PARTY SOFTWARE THAT MAY BE CONTAINED ' + `IN PORTIONS OF THE ${String(manifest.name).toUpperCase().replace(/-/g, ' ')} PRODUCT.`);
      console.log();

      for (var _iterator3 = manifestsByLicense, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
        var _ref7;

        if (_isArray3) {
          if (_i3 >= _iterator3.length) break;
          _ref7 = _iterator3[_i3++];
        } else {
          _i3 = _iterator3.next();
          if (_i3.done) break;
          _ref7 = _i3.value;
        }

        const _ref6 = _ref7;
        const licenseKey = _ref6[0];
        const manifests = _ref6[1];

        console.log('-----');
        console.log();

        const names = [];
        const urls = [];
        for (var _iterator4 = manifests, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
          var _ref9;

          if (_isArray4) {
            if (_i4 >= _iterator4.length) break;
            _ref9 = _iterator4[_i4++];
          } else {
            _i4 = _iterator4.next();
            if (_i4.done) break;
            _ref9 = _i4.value;
          }

          const _ref8 = _ref9;
          const name = _ref8[0];
          const repository = _ref8[1].repository;

          names.push(name);
          if (repository && repository.url) {
            urls.push(manifests.size === 1 ? repository.url : `${repository.url} (${name})`);
          }
        }

        const heading = [];
        heading.push(`The following software may be included in this product: ${names.join(', ')}.`);
        if (urls.length > 0) {
          heading.push(`A copy of the source code may be downloaded from ${urls.join(', ')}.`);
        }
        heading.push('This software contains the following license and notice below:');

        console.log(heading.join(' '));
        console.log();

        if (licenseKey) {
          console.log(licenseKey.trim());
        } else {
          // what do we do here? base it on `license`?
        }

        console.log();
      }
    })();
  }
});

const run = _buildSubCommands.run,
      examples = _buildSubCommands.examples;
exports.run = run;
exports.examples = examples;