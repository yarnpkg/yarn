#!/usr/bin/env node

/* eslint-disable flowtype/require-valid-file-annotation */
'use strict';

require('../lib/v8-compile-cache');
module.exports = require('../lib/yarn-cli');
const main = module.exports.default;

// ignore all arguments after a --
const doubleDashIndex = process.argv.findIndex(element => element === '--');
const startArgs = process.argv.slice(0, 2);
const args = process.argv.slice(2, doubleDashIndex === -1 ? process.argv.length : doubleDashIndex);
const endArgs = doubleDashIndex === -1 ? [] : process.argv.slice(doubleDashIndex + 1, process.argv.length);

main({startArgs, args, endArgs});
