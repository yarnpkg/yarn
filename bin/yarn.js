#!/usr/bin/env node

/* eslint-disable flowtype/require-valid-file-annotation */
'use strict';

// init roadrunner
const mkdirp = require('mkdirp');
const constants = require('../lib-legacy/constants');
mkdirp.sync(constants.GLOBAL_INSTALL_DIRECTORY);
const roadrunner = require('roadrunner');
roadrunner.load(constants.CACHE_FILENAME);
roadrunner.setup(constants.CACHE_FILENAME);

// get node version
const semver = require('semver');
let ver = process.versions.node;
ver = ver.split('-')[0]; // explode and truncate tag from version #511

const possibles = [];
let found = false;
let _err;

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

let i = 0;
for (; i < possibles.length; i++) {
  const possible = possibles[i];
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
