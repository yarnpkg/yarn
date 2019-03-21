'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.exec = exports.queue = undefined;
exports.forkp = forkp;
exports.spawnp = spawnp;
exports.forwardSignalToSpawnedProcesses = forwardSignalToSpawnedProcesses;
exports.spawn = spawn;

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('../constants.js'));
}

var _blockingQueue;

function _load_blockingQueue() {
  return _blockingQueue = _interopRequireDefault(require('./blocking-queue.js'));
}

var _errors;

function _load_errors() {
  return _errors = require('../errors.js');
}

var _promise;

function _load_promise() {
  return _promise = require('./promise.js');
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

/* global child_process$spawnOpts */

const child = require('child_process');

const queue = exports.queue = new (_blockingQueue || _load_blockingQueue()).default('child', (_constants || _load_constants()).CHILD_CONCURRENCY);

// TODO: this uid check is kinda whack
let uid = 0;

const exec = exports.exec = (0, (_promise || _load_promise()).promisify)(child.exec);

function forkp(program, args, opts) {
  return new Promise((resolve, reject) => {
    const proc = child.fork(program, args, opts);

    proc.on('error', error => {
      reject(error);
    });

    proc.on('close', exitCode => {
      resolve(exitCode);
    });
  });
}

function spawnp(program, args, opts) {
  return new Promise((resolve, reject) => {
    const proc = child.spawn(program, args, opts);

    proc.on('error', error => {
      reject(error);
    });

    proc.on('close', exitCode => {
      resolve(exitCode);
    });
  });
}

const spawnedProcesses = {};

function forwardSignalToSpawnedProcesses(signal) {
  for (var _iterator = Object.keys(spawnedProcesses), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
    var _ref;

    if (_isArray) {
      if (_i >= _iterator.length) break;
      _ref = _iterator[_i++];
    } else {
      _i = _iterator.next();
      if (_i.done) break;
      _ref = _i.value;
    }

    const key = _ref;

    spawnedProcesses[key].kill(signal);
  }
}

function spawn(program, args, opts = {}, onData) {
  const key = opts.cwd || String(++uid);
  return queue.push(key, () => new Promise((resolve, reject) => {
    const proc = child.spawn(program, args, opts);
    spawnedProcesses[key] = proc;

    let processingDone = false;
    let processClosed = false;
    let err = null;

    let stdout = '';

    proc.on('error', err => {
      if (err.code === 'ENOENT') {
        reject(new (_errors || _load_errors()).ProcessSpawnError(`Couldn't find the binary ${program}`, err.code, program));
      } else {
        reject(err);
      }
    });

    function updateStdout(chunk) {
      stdout += chunk;
      if (onData) {
        onData(chunk);
      }
    }

    function finish() {
      delete spawnedProcesses[key];
      if (err) {
        reject(err);
      } else {
        resolve(stdout.trim());
      }
    }

    if (typeof opts.process === 'function') {
      opts.process(proc, updateStdout, reject, function () {
        if (processClosed) {
          finish();
        } else {
          processingDone = true;
        }
      });
    } else {
      if (proc.stderr) {
        proc.stderr.on('data', updateStdout);
      }

      if (proc.stdout) {
        proc.stdout.on('data', updateStdout);
      }

      processingDone = true;
    }

    proc.on('close', (code, signal) => {
      if (signal || code >= 1) {
        err = new (_errors || _load_errors()).ProcessTermError(['Command failed.', signal ? `Exit signal: ${signal}` : `Exit code: ${code}`, `Command: ${program}`, `Arguments: ${args.join(' ')}`, `Directory: ${opts.cwd || process.cwd()}`, `Output:\n${stdout.trim()}`].join('\n'));
        err.EXIT_SIGNAL = signal;
        err.EXIT_CODE = code;
      }

      if (processingDone || err) {
        finish();
      } else {
        processClosed = true;
      }
    });
  }));
}