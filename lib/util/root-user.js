'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isFakeRoot = isFakeRoot;
exports.isRootUser = isRootUser;
function getUid() {
  if (process.platform !== 'win32' && process.getuid) {
    return process.getuid();
  }
  return null;
}

exports.default = isRootUser(getUid()) && !isFakeRoot();
function isFakeRoot() {
  return Boolean(process.env.FAKEROOTKEY);
}

function isRootUser(uid) {
  return uid === 0;
}