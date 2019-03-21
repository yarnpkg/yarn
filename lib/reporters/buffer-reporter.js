'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _jsonReporter;

function _load_jsonReporter() {
  return _jsonReporter = _interopRequireDefault(require('./json-reporter.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class BufferReporter extends (_jsonReporter || _load_jsonReporter()).default {
  constructor(opts) {
    super(opts);
    this._buffer = [];
  }

  _dump(type, data, error) {
    this._buffer.push({
      type,
      data,
      error: !!error
    });
  }

  getBuffer() {
    return this._buffer;
  }

  getBufferText() {
    return this._buffer.map(({ data }) => typeof data === 'string' ? data : JSON.stringify(data)).join('');
  }

  getBufferJson() {
    return JSON.parse(this.getBufferText());
  }
}
exports.default = BufferReporter;