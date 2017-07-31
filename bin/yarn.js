#!/usr/bin/env node

/* eslint-disable no-var */
/* eslint-disable flowtype/require-valid-file-annotation */
'use strict';

var ver = process.versions.node;
var majorVer = parseInt(ver.split('.')[0], 10);

var dirPath = null;

if (majorVer >= 5) {
  dirPath = '../lib/';
} else if (majorVer >= 4) {
  dirPath = '../lib-legacy/';
} else {
  console.error('Node version ' + ver + ' is not supported, please use Node.js 4.0 or higher.');
  process.exitCode = 1;
}

if (dirPath) {
  require(dirPath + 'v8-compile-cache');
  // Just requiring this package will trigger a yarn run since the
  // `require.main === module` check inside `cli/index.js` will always
  // be truthy when built with webpack :(
  require(dirPath + 'yarn');
}
