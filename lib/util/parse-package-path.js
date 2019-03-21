"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = parsePackagePath;
exports.isValidPackagePath = isValidPackagePath;


/**
 * Parse input strings like `package-1/package-2` to an array of packages
 */
function parsePackagePath(input) {
  return input.match(/(@[^\/]+\/)?([^/]+)/g) || [];
}

const WRONG_PATTERNS = /\/$|\/{2,}|\*+$/;

function isValidPackagePath(input) {
  return !WRONG_PATTERNS.test(input);
}