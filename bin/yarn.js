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

// init roadrunner
var YARN_VERSION = require('../package.json').version;
var roadrunner = require('roadrunner');

// load cache
roadrunner.load(constants.CACHE_FILENAME);
var cacheVersion = roadrunner.get('CACHE_BREAKER').version;
if (!cacheVersion || cacheVersion !== YARN_VERSION) {
  // reset cache if it's for an older yarn
  roadrunner.reset(constants.CACHE_FILENAME);
}
// set this cache to the current yarn version
roadrunner.set('CACHE_BREAKER', {version: YARN_VERSION});

// save cache on SIGINT
roadrunner.setup(constants.CACHE_FILENAME);

module.exports = require(path);
