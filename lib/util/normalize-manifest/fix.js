'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _constants;

function _load_constants() {
  return _constants = require('../../constants');
}

var _util;

function _load_util() {
  return _util = require('./util.js');
}

var _index;

function _load_index() {
  return _index = require('../../resolvers/index.js');
}

var _inferLicense;

function _load_inferLicense() {
  return _inferLicense = _interopRequireDefault(require('./infer-license.js'));
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../fs.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const semver = require('semver');
const path = require('path');
const url = require('url');

const LICENSE_RENAMES = {
  'MIT/X11': 'MIT',
  X11: 'MIT'
};

exports.default = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (info, moduleLoc, reporter, warn, looseSemver) {
    const files = yield (_fs || _load_fs()).readdir(moduleLoc);

    // clean info.version
    if (typeof info.version === 'string') {
      info.version = semver.clean(info.version, looseSemver) || info.version;
    }

    // if name or version aren't set then set them to empty strings
    info.name = info.name || '';
    info.version = info.version || '';

    // if the man field is a string then coerce it to an array
    if (typeof info.man === 'string') {
      info.man = [info.man];
    }

    // if the keywords field is a string then split it on any whitespace
    if (typeof info.keywords === 'string') {
      info.keywords = info.keywords.split(/\s+/g);
    }

    // if there's no contributors field but an authors field then expand it
    if (!info.contributors && files.indexOf('AUTHORS') >= 0) {
      const authorsFilepath = path.join(moduleLoc, 'AUTHORS');
      const authorsFilestats = yield (_fs || _load_fs()).stat(authorsFilepath);
      if (authorsFilestats.isFile()) {
        let authors = yield (_fs || _load_fs()).readFile(authorsFilepath);
        authors = authors.split(/\r?\n/g) // split on lines
        .map(function (line) {
          return line.replace(/^\s*#.*$/, '').trim();
        }) // remove comments
        .filter(function (line) {
          return !!line;
        }); // remove empty lines
        info.contributors = authors;
      }
    }

    // expand people fields to objects
    if (typeof info.author === 'string' || typeof info.author === 'object') {
      info.author = (0, (_util || _load_util()).normalizePerson)(info.author);
    }
    if (Array.isArray(info.contributors)) {
      info.contributors = info.contributors.map((_util || _load_util()).normalizePerson);
    }
    if (Array.isArray(info.maintainers)) {
      info.maintainers = info.maintainers.map((_util || _load_util()).normalizePerson);
    }

    // if there's no readme field then load the README file from the cwd
    if (!info.readme) {
      const readmeCandidates = files.filter(function (filename) {
        const lower = filename.toLowerCase();
        return lower === 'readme' || lower.indexOf('readme.') === 0;
      }).sort(function (filename1, filename2) {
        // favor files with extensions
        return filename2.indexOf('.') - filename1.indexOf('.');
      });

      for (var _iterator = readmeCandidates, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
        var _ref2;

        if (_isArray) {
          if (_i >= _iterator.length) break;
          _ref2 = _iterator[_i++];
        } else {
          _i = _iterator.next();
          if (_i.done) break;
          _ref2 = _i.value;
        }

        const readmeFilename = _ref2;

        const readmeFilepath = path.join(moduleLoc, readmeFilename);
        const readmeFileStats = yield (_fs || _load_fs()).stat(readmeFilepath);
        if (readmeFileStats.isFile()) {
          info.readmeFilename = readmeFilename;
          info.readme = yield (_fs || _load_fs()).readFile(readmeFilepath);
          break;
        }
      }
    }

    // if there's no description then take the first paragraph from the readme
    if (!info.description && info.readme) {
      const desc = (0, (_util || _load_util()).extractDescription)(info.readme);
      if (desc) {
        info.description = desc;
      }
    }

    // support array of engine keys
    if (Array.isArray(info.engines)) {
      const engines = {};
      for (var _iterator2 = info.engines, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
        var _ref3;

        if (_isArray2) {
          if (_i2 >= _iterator2.length) break;
          _ref3 = _iterator2[_i2++];
        } else {
          _i2 = _iterator2.next();
          if (_i2.done) break;
          _ref3 = _i2.value;
        }

        const str = _ref3;

        if (typeof str === 'string') {
          var _str$trim$split = str.trim().split(/ +/g);

          const name = _str$trim$split[0],
                patternParts = _str$trim$split.slice(1);

          engines[name] = patternParts.join(' ');
        }
      }
      info.engines = engines;
    }

    // if the repository field is a string then assume it's a git repo and expand it
    if (typeof info.repository === 'string') {
      info.repository = {
        type: 'git',
        url: info.repository
      };
    }

    const repo = info.repository;

    // explode info.repository.url if it's a hosted git shorthand
    if (repo && typeof repo === 'object' && typeof repo.url === 'string') {
      repo.url = (0, (_index || _load_index()).hostedGitFragmentToGitUrl)(repo.url, reporter);
    }

    // allow bugs to be specified as a string, expand it to an object with a single url prop
    if (typeof info.bugs === 'string') {
      info.bugs = { url: info.bugs };
    }

    // normalize homepage url to http
    if (typeof info.homepage === 'string') {
      const parts = url.parse(info.homepage);
      parts.protocol = parts.protocol || 'http:';
      if (parts.pathname && !parts.hostname) {
        parts.hostname = parts.pathname;
        parts.pathname = '';
      }
      info.homepage = url.format(parts);
    }

    // if the `bin` field is as string then expand it to an object with a single property
    // based on the original `bin` field and `name field`
    // { name: "foo", bin: "cli.js" } -> { name: "foo", bin: { foo: "cli.js" } }
    if (typeof info.name === 'string' && typeof info.bin === 'string' && info.bin.length > 0) {
      // Remove scoped package name for consistency with NPM's bin field fixing behaviour
      const name = info.name.replace(/^@[^\/]+\//, '');
      info.bin = { [name]: info.bin };
    }

    // bundleDependencies is an alias for bundledDependencies
    if (info.bundledDependencies) {
      info.bundleDependencies = info.bundledDependencies;
      delete info.bundledDependencies;
    }

    let scripts;

    // dummy script object to shove file inferred scripts onto
    if (info.scripts && typeof info.scripts === 'object') {
      scripts = info.scripts;
    } else {
      scripts = {};
    }

    // if there's a server.js file and no start script then set it to `node server.js`
    if (!scripts.start && files.indexOf('server.js') >= 0) {
      scripts.start = 'node server.js';
    }

    // if there's a binding.gyp file and no install script then set it to `node-gyp rebuild`
    if (!scripts.install && files.indexOf('binding.gyp') >= 0) {
      scripts.install = 'node-gyp rebuild';
    }

    // set scripts if we've polluted the empty object
    if (Object.keys(scripts).length) {
      info.scripts = scripts;
    }

    const dirs = info.directories;

    if (dirs && typeof dirs === 'object') {
      const binDir = dirs.bin;

      if (!info.bin && binDir && typeof binDir === 'string') {
        const bin = info.bin = {};
        const fullBinDir = path.join(moduleLoc, binDir);

        if (yield (_fs || _load_fs()).exists(fullBinDir)) {
          for (var _iterator3 = yield (_fs || _load_fs()).readdir(fullBinDir), _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
            var _ref4;

            if (_isArray3) {
              if (_i3 >= _iterator3.length) break;
              _ref4 = _iterator3[_i3++];
            } else {
              _i3 = _iterator3.next();
              if (_i3.done) break;
              _ref4 = _i3.value;
            }

            const scriptName = _ref4;

            if (scriptName[0] === '.') {
              continue;
            }
            bin[scriptName] = path.join('.', binDir, scriptName);
          }
        } else {
          warn(reporter.lang('manifestDirectoryNotFound', binDir, info.name));
        }
      }

      const manDir = dirs.man;

      if (!info.man && typeof manDir === 'string') {
        const man = info.man = [];
        const fullManDir = path.join(moduleLoc, manDir);

        if (yield (_fs || _load_fs()).exists(fullManDir)) {
          for (var _iterator4 = yield (_fs || _load_fs()).readdir(fullManDir), _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
            var _ref5;

            if (_isArray4) {
              if (_i4 >= _iterator4.length) break;
              _ref5 = _iterator4[_i4++];
            } else {
              _i4 = _iterator4.next();
              if (_i4.done) break;
              _ref5 = _i4.value;
            }

            const filename = _ref5;

            if (/^(.*?)\.[0-9]$/.test(filename)) {
              man.push(path.join('.', manDir, filename));
            }
          }
        } else {
          warn(reporter.lang('manifestDirectoryNotFound', manDir, info.name));
        }
      }
    }

    delete info.directories;

    // normalize licenses field
    const licenses = info.licenses;
    if (Array.isArray(licenses) && !info.license) {
      let licenseTypes = [];

      for (var _iterator5 = licenses, _isArray5 = Array.isArray(_iterator5), _i5 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
        var _ref6;

        if (_isArray5) {
          if (_i5 >= _iterator5.length) break;
          _ref6 = _iterator5[_i5++];
        } else {
          _i5 = _iterator5.next();
          if (_i5.done) break;
          _ref6 = _i5.value;
        }

        let license = _ref6;

        if (license && typeof license === 'object') {
          license = license.type;
        }
        if (typeof license === 'string') {
          licenseTypes.push(license);
        }
      }

      licenseTypes = licenseTypes.filter((_util || _load_util()).isValidLicense);

      if (licenseTypes.length === 1) {
        info.license = licenseTypes[0];
      } else if (licenseTypes.length) {
        info.license = `(${licenseTypes.join(' OR ')})`;
      }
    }

    const license = info.license;

    // normalize license
    if (license && typeof license === 'object') {
      info.license = license.type;
    }

    // get license file
    const licenseFile = files.find(function (filename) {
      const lower = filename.toLowerCase();
      return lower === 'license' || lower.startsWith('license.') || lower === 'unlicense' || lower.startsWith('unlicense.');
    });
    if (licenseFile) {
      const licenseFilepath = path.join(moduleLoc, licenseFile);
      const licenseFileStats = yield (_fs || _load_fs()).stat(licenseFilepath);
      if (licenseFileStats.isFile()) {
        const licenseContent = yield (_fs || _load_fs()).readFile(licenseFilepath);
        const inferredLicense = (0, (_inferLicense || _load_inferLicense()).default)(licenseContent);
        info.licenseText = licenseContent;

        const license = info.license;

        if (typeof license === 'string') {
          if (inferredLicense && (0, (_util || _load_util()).isValidLicense)(inferredLicense) && !(0, (_util || _load_util()).isValidLicense)(license)) {
            // some packages don't specify their license version but we can infer it based on their license file
            const basicLicense = license.toLowerCase().replace(/(-like|\*)$/g, '');
            const expandedLicense = inferredLicense.toLowerCase();
            if (expandedLicense.startsWith(basicLicense)) {
              // TODO consider doing something to notify the user
              info.license = inferredLicense;
            }
          }
        } else if (inferredLicense) {
          // if there's no license then infer it based on the license file
          info.license = inferredLicense;
        } else {
          // valid expression to refer to a license in a file
          info.license = `SEE LICENSE IN ${licenseFile}`;
        }
      }
    }

    if (typeof info.license === 'string') {
      // sometimes licenses are known by different names, reduce them
      info.license = LICENSE_RENAMES[info.license] || info.license;
    } else if (typeof info.readme === 'string') {
      // the license might be at the bottom of the README
      const inferredLicense = (0, (_inferLicense || _load_inferLicense()).default)(info.readme);
      if (inferredLicense) {
        info.license = inferredLicense;
      }
    }

    // get notice file
    const noticeFile = files.find(function (filename) {
      const lower = filename.toLowerCase();
      return lower === 'notice' || lower.startsWith('notice.');
    });
    if (noticeFile) {
      const noticeFilepath = path.join(moduleLoc, noticeFile);
      const noticeFileStats = yield (_fs || _load_fs()).stat(noticeFilepath);
      if (noticeFileStats.isFile()) {
        info.noticeText = yield (_fs || _load_fs()).readFile(noticeFilepath);
      }
    }

    for (var _iterator6 = (_constants || _load_constants()).MANIFEST_FIELDS, _isArray6 = Array.isArray(_iterator6), _i6 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
      var _ref7;

      if (_isArray6) {
        if (_i6 >= _iterator6.length) break;
        _ref7 = _iterator6[_i6++];
      } else {
        _i6 = _iterator6.next();
        if (_i6.done) break;
        _ref7 = _i6.value;
      }

      const dependencyType = _ref7;

      const dependencyList = info[dependencyType];
      if (dependencyList && typeof dependencyList === 'object') {
        delete dependencyList['//'];
        for (const name in dependencyList) {
          dependencyList[name] = dependencyList[name] || '';
        }
      }
    }
  });

  return function (_x, _x2, _x3, _x4, _x5) {
    return _ref.apply(this, arguments);
  };
})();