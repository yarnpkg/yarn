"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = parsePackageName;


const PKG_INPUT = /(^\S?[^\s@]+)(?:@(\S+))?$/;

function parsePackageName(input) {
  var _PKG_INPUT$exec = PKG_INPUT.exec(input);

  const name = _PKG_INPUT$exec[1],
        version = _PKG_INPUT$exec[2];

  return { name, version };
}