'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isOffline = isOffline;
const os = require('os');

const IGNORE_INTERFACES = ['lo0', 'awdl0', 'bridge0'];
const LOCAL_IPS = ['127.0.0.1', '::1'];

function isOffline() {
  let interfaces;

  try {
    interfaces = os.networkInterfaces();
  } catch (e) {
    // As of October 2016, Windows Subsystem for Linux (WSL) does not support
    // the os.networkInterfaces() call and throws instead. For this platform,
    // assume we are online.
    if (e.syscall === 'uv_interface_addresses') {
      return false;
    } else {
      throw e;
    }
  }

  for (const name in interfaces) {
    if (IGNORE_INTERFACES.indexOf(name) >= 0) {
      continue;
    }

    const addrs = interfaces[name];
    for (var _iterator = addrs, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
      var _ref;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref = _i.value;
      }

      const addr = _ref;

      if (LOCAL_IPS.indexOf(addr.address) < 0) {
        // found a possible remote ip
        return false;
      }
    }
  }

  return true;
}