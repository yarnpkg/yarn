#!/usr/bin/env node

/* eslint-disable no-var */
/* eslint-disable flowtype/require-valid-file-annotation */
'use strict';

// validate that used node version is supported
var semver = require('semver');
var ver = process.versions.node;
ver = ver.split('-')[0]; // explode and truncate tag from version #511

var path = null;

if (semver.satisfies(ver, '>=5.0.0')) {
  path = '../lib/cli/index.js';
} else if (semver.satisfies(ver, '>=4.0.0')) {
  path = '../lib-legacy/cli/index.js';
} else {
  console.log(require('chalk').red('Node version ' + ver + ' is not supported, please use Node.js 4.0 or higher.'));
  process.exit(1);
}

// load v8-compile-cache
if (semver.satisfies(ver, '>=5.7.0')) {
  require('v8-compile-cache');
}

// ensure cache directory exists
var mkdirp = require('mkdirp');
var constants = require('../lib-legacy/constants');
mkdirp.sync(constants.MODULE_CACHE_DIRECTORY);

module.exports = require(path);
