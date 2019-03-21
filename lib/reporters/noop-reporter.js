'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _baseReporter;

function _load_baseReporter() {
  return _baseReporter = _interopRequireDefault(require('./base-reporter.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint no-unused-vars: 0 */

class NoopReporter extends (_baseReporter || _load_baseReporter()).default {
  lang(key, ...args) {
    return 'do nothing';
  }
  verbose(msg) {}
  verboseInspect(val) {}
  initPeakMemoryCounter() {}
  checkPeakMemory() {}
  close() {}
  getTotalTime() {
    return 0;
  }
  list(key, items, hints) {}
  tree(key, obj) {}
  step(current, total, message, emoji) {}
  error(message) {}
  info(message) {}
  warn(message) {}
  success(message) {}
  log(message) {}
  command(command) {}
  inspect(value) {}
  header(command, pkg) {}
  footer(showPeakMemory) {}
  table(head, body) {}

  activity() {
    return {
      tick(name) {},
      end() {}
    };
  }

  activitySet(total, workers) {
    return {
      spinners: Array(workers).fill({
        clear() {},
        setPrefix() {},
        tick() {},
        end() {}
      }),
      end() {}
    };
  }

  question(question, options = {}) {
    return Promise.reject(new Error('Not implemented'));
  }

  questionAffirm(question) {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      yield _this.question(question);
      return false;
    })();
  }

  select(header, question, options) {
    return Promise.reject(new Error('Not implemented'));
  }

  progress(total) {
    return function () {};
  }

  disableProgress() {
    this.noProgress = true;
  }

  prompt(message, choices, options = {}) {
    return Promise.reject(new Error('Not implemented'));
  }
}
exports.default = NoopReporter;