#!/usr/bin/env node

/* eslint-disable no-var */
/* eslint-disable flowtype/require-valid-file-annotation */
'use strict';

// init roadrunner
var mkdirp = require('mkdirp');
var constants = require('../lib-legacy/constants');
mkdirp.sync(constants.GLOBAL_INSTALL_DIRECTORY);
var roadrunner = require('roadrunner');
roadrunner.load(constants.CACHE_FILENAME);
roadrunner.setup(constants.CACHE_FILENAME);

// get node version
var semver = require('semver');
var ver = process.versions.node;
ver = ver.split('-')[0]; // explode and truncate tag from version #511

var possibles = [];
var found = false;
var _err;

if (semver.satisfies(ver, '>=5.0.0')) {
  possibles.push('../updates/current/lib/cli/index.js');
  possibles.push('../lib/cli/index.js');
} else if (semver.satisfies(ver, '>=4.0.0')) {
  possibles.push('../updates/current/lib-legacy/cli/index.js');
  possibles.push('../lib-legacy/cli/index.js');
} else {
  console.log(require('chalk').red('Node version ' + ver + ' is not supported, please use Node.js 4.0 or higher.'));
  process.exit(1);
}

var i = 0;
for (; i < possibles.length; i++) {
  var possible = possibles[i];
  try {
    module.exports = require(possible);
    found = true;
    break;
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      _err = err;
      continue;
    } else {
      throw err;
    }
  }
}

if (!found) {
  throw _err || new Error('Failed to load');
}
