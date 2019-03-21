'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (message) {
  return {
    useless: true,
    run() {
      throw new (_errors || _load_errors()).MessageError(message);
    },
    setFlags: () => {},
    hasWrapper: () => true
  };
};

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}