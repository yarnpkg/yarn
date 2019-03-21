'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.explodeHashedUrl = explodeHashedUrl;
function explodeHashedUrl(url) {
  const parts = url.split('#');

  return {
    hash: parts[1] || '',
    url: parts[0]
  };
}