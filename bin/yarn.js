#!/usr/bin/env node

/* eslint-disable no-var */
/* eslint-disable flowtype/require-valid-file-annotation */
'use strict';

// init roadrunner
var userHome = require('user-home');
var mkdirp = require('mkdirp');
var path = require('path');
var CACHE_FILENAME = path.join(userHome, '.yarn', '.roadrunner.json');
mkdirp.sync(path.dirname(CACHE_FILENAME));
var roadrunner = require('roadrunner');
roadrunner.load(CACHE_FILENAME);
roadrunner.setup(CACHE_FILENAME);

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
  throw new Error('Node version ' + ver + ' is not supported');
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
