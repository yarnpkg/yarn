'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _jsonReporter;

function _load_jsonReporter() {
  return _jsonReporter = _interopRequireDefault(require('./json-reporter.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _require = require('events');

const EventEmitter = _require.EventEmitter;
class EventReporter extends (_jsonReporter || _load_jsonReporter()).default {

  constructor(opts) {
    super(opts);

    // $FlowFixMe: looks like a flow bug
    EventEmitter.call(this);
  }

  _dump(type, data) {
    this.emit(type, data);
  }
}

exports.default = EventReporter;
Object.assign(EventReporter.prototype, EventEmitter.prototype);