'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (from, to, reporter) {
  const parts = to.split('.');
  const fromParts = from.split('.');

  const splitIndex = parts.findIndex((part, i) => part !== fromParts[i]);
  if (splitIndex === -1) {
    return from;
  }

  const colorized = reporter.format.green(parts.slice(splitIndex).join('.'));
  return parts.slice(0, splitIndex).concat(colorized).join('.');
};