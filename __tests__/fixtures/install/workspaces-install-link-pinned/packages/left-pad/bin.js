#!/usr/bin/env node

var leftPad = require('./');

console.log(leftPad(...process.argv.slice(0, 2)));
