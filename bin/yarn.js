#!/usr/bin/env node

/* eslint-disable no-var */
/* eslint-disable flowtype/require-valid-file-annotation */
'use strict';

var semver = require('semver');
var ver = process.versions.node;
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
