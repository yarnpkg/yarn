#!/usr/bin/env node

/* eslint-disable no-var */
/* eslint-disable flowtype/require-valid-file-annotation */
'use strict';

// validate that used node version is supported
var semver = require('semver');
var ver = process.versions.node;
ver = ver.split('-')[0]; // explode and truncate tag from version #511

var dirPath = null;

if (semver.satisfies(ver, '>=5.0.0')) {
  dirPath = '../lib';
} else if (semver.satisfies(ver, '>=4.0.0')) {
  dirPath = '../lib-legacy';
} else {
  console.log(require('chalk').red('Node version ' + ver + ' is not supported, please use Node.js 4.0 or higher.'));
  // We need to skip the rest and terminate here since the Node version is not supported.
  // `console.log` calls are sync so we don't have a risk of exiting early before stdout flushes
  process.exit(1); // eslint-disable-line no-process-exit
}

// load v8-compile-cache
if (semver.satisfies(ver, '>=5.7.0')) {
  require('v8-compile-cache');
}

// ensure cache directory exists
var mkdirp = require('mkdirp');
var constants = require(dirPath + '/constants');
mkdirp.sync(constants.MODULE_CACHE_DIRECTORY);

module.exports = require(dirPath + '/cli');
const main = module.exports.default;

// ignore all arguments after a --
const doubleDashIndex = process.argv.findIndex(element => element === '--');
const startArgs = process.argv.slice(0, 2);
const args = process.argv.slice(2, doubleDashIndex === -1 ? process.argv.length : doubleDashIndex);
const endArgs = doubleDashIndex === -1 ? [] : process.argv.slice(doubleDashIndex + 1, process.argv.length);

main({startArgs, args, endArgs});
