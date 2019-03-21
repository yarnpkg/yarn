'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.explodeGistFragment = explodeGistFragment;

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _gitResolver;

function _load_gitResolver() {
  return _gitResolver = _interopRequireDefault(require('./git-resolver.js'));
}

var _exoticResolver;

function _load_exoticResolver() {
  return _exoticResolver = _interopRequireDefault(require('./exotic-resolver.js'));
}

var _misc;

function _load_misc() {
  return _misc = _interopRequireWildcard(require('../../util/misc.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function explodeGistFragment(fragment, reporter) {
  fragment = (_misc || _load_misc()).removePrefix(fragment, 'gist:');

  const parts = fragment.split('#');

  if (parts.length <= 2) {
    return {
      id: parts[0],
      hash: parts[1] || ''
    };
  } else {
    throw new (_errors || _load_errors()).MessageError(reporter.lang('invalidGistFragment', fragment));
  }
}

class GistResolver extends (_exoticResolver || _load_exoticResolver()).default {

  constructor(request, fragment) {
    super(request, fragment);

    var _explodeGistFragment = explodeGistFragment(fragment, this.reporter);

    const id = _explodeGistFragment.id,
          hash = _explodeGistFragment.hash;

    this.id = id;
    this.hash = hash;
  }

  resolve() {
    return this.fork((_gitResolver || _load_gitResolver()).default, false, `https://gist.github.com/${this.id}.git#${this.hash}`);
  }
}
exports.default = GistResolver;
GistResolver.protocol = 'gist';