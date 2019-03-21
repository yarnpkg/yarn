'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

var _extends2;

function _load_extends() {
  return _extends2 = _interopRequireDefault(require('babel-runtime/helpers/extends'));
}

var _invariant;

function _load_invariant() {
  return _invariant = _interopRequireDefault(require('invariant'));
}

var _string_decoder;

function _load_string_decoder() {
  return _string_decoder = require('string_decoder');
}

var _tarFs;

function _load_tarFs() {
  return _tarFs = _interopRequireDefault(require('tar-fs'));
}

var _tarStream;

function _load_tarStream() {
  return _tarStream = _interopRequireDefault(require('tar-stream'));
}

var _url;

function _load_url() {
  return _url = _interopRequireDefault(require('url'));
}

var _fs;

function _load_fs() {
  return _fs = require('fs');
}

var _errors;

function _load_errors() {
  return _errors = require('../errors.js');
}

var _gitSpawn;

function _load_gitSpawn() {
  return _gitSpawn = require('./git/git-spawn.js');
}

var _gitRefResolver;

function _load_gitRefResolver() {
  return _gitRefResolver = require('./git/git-ref-resolver.js');
}

var _crypto;

function _load_crypto() {
  return _crypto = _interopRequireWildcard(require('./crypto.js'));
}

var _fs2;

function _load_fs2() {
  return _fs2 = _interopRequireWildcard(require('./fs.js'));
}

var _map;

function _load_map() {
  return _map = _interopRequireDefault(require('./map.js'));
}

var _misc;

function _load_misc() {
  return _misc = require('./misc.js');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const GIT_PROTOCOL_PREFIX = 'git+';

const SSH_PROTOCOL = 'ssh:';
const SCP_PATH_PREFIX = '/:';
const FILE_PROTOCOL = 'file:';
const GIT_VALID_REF_LINE_REGEXP = /^([a-fA-F0-9]+|ref)/;

const validRef = line => {
  return GIT_VALID_REF_LINE_REGEXP.exec(line);
};

const supportsArchiveCache = (0, (_map || _load_map()).default)({
  'github.com': false // not support, doubt they will ever support it
});

const handleSpawnError = err => {
  if (err instanceof (_errors || _load_errors()).ProcessSpawnError) {
    throw err;
  }
};

const SHORTHAND_SERVICES = (0, (_map || _load_map()).default)({
  'github:': parsedUrl => (0, (_extends2 || _load_extends()).default)({}, parsedUrl, {
    slashes: true,
    auth: 'git',
    protocol: SSH_PROTOCOL,
    host: 'github.com',
    hostname: 'github.com',
    pathname: `/${parsedUrl.hostname}${parsedUrl.pathname}`
  }),
  'bitbucket:': parsedUrl => (0, (_extends2 || _load_extends()).default)({}, parsedUrl, {
    slashes: true,
    auth: 'git',
    protocol: SSH_PROTOCOL,
    host: 'bitbucket.com',
    hostname: 'bitbucket.com',
    pathname: `/${parsedUrl.hostname}${parsedUrl.pathname}`
  })
});

class Git {
  constructor(config, gitUrl, hash) {
    this.supportsArchive = false;
    this.fetched = false;
    this.config = config;
    this.reporter = config.reporter;
    this.hash = hash;
    this.ref = hash;
    this.gitUrl = gitUrl;
    this.cwd = this.config.getTemp((_crypto || _load_crypto()).hash(this.gitUrl.repository));
  }

  /**
   * npm URLs contain a 'git+' scheme prefix, which is not understood by git.
   * git "URLs" also allow an alternative scp-like syntax, so they're not standard URLs.
   */
  static npmUrlToGitUrl(npmUrl) {
    npmUrl = (0, (_misc || _load_misc()).removePrefix)(npmUrl, GIT_PROTOCOL_PREFIX);

    let parsed = (_url || _load_url()).default.parse(npmUrl);
    const expander = parsed.protocol && SHORTHAND_SERVICES[parsed.protocol];

    if (expander) {
      parsed = expander(parsed);
    }

    // Special case in npm, where ssh:// prefix is stripped to pass scp-like syntax
    // which in git works as remote path only if there are no slashes before ':'.
    // See #3146.
    if (parsed.protocol === SSH_PROTOCOL && parsed.hostname && parsed.path && parsed.path.startsWith(SCP_PATH_PREFIX) && parsed.port === null) {
      const auth = parsed.auth ? parsed.auth + '@' : '';
      const pathname = parsed.path.slice(SCP_PATH_PREFIX.length);
      return {
        hostname: parsed.hostname,
        protocol: parsed.protocol,
        repository: `${auth}${parsed.hostname}:${pathname}`
      };
    }

    // git local repos are specified as `git+file:` and a filesystem path, not a url.
    let repository;
    if (parsed.protocol === FILE_PROTOCOL) {
      repository = parsed.path;
    } else {
      repository = (_url || _load_url()).default.format((0, (_extends2 || _load_extends()).default)({}, parsed, { hash: '' }));
    }

    return {
      hostname: parsed.hostname || null,
      protocol: parsed.protocol || FILE_PROTOCOL,
      repository: repository || ''
    };
  }

  /**
   * Check if the host specified in the input `gitUrl` has archive capability.
   */

  static hasArchiveCapability(ref) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const hostname = ref.hostname;
      if (ref.protocol !== 'ssh:' || hostname == null) {
        return false;
      }

      if (hostname in supportsArchiveCache) {
        return supportsArchiveCache[hostname];
      }

      try {
        yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['archive', `--remote=${ref.repository}`, 'HEAD', Date.now() + '']);
        throw new Error();
      } catch (err) {
        handleSpawnError(err);
        const supports = err.message.indexOf('did not match any files') >= 0;
        return supportsArchiveCache[hostname] = supports;
      }
    })();
  }

  /**
   * Check if the input `target` is a 5-40 character hex commit hash.
   */

  static repoExists(ref) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const isLocal = ref.protocol === FILE_PROTOCOL;

      try {
        if (isLocal) {
          yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['show-ref', '-t'], { cwd: ref.repository });
        } else {
          yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['ls-remote', '-t', ref.repository]);
        }
        return true;
      } catch (err) {
        handleSpawnError(err);
        return false;
      }
    })();
  }

  static replaceProtocol(ref, protocol) {
    return {
      hostname: ref.hostname,
      protocol,
      repository: ref.repository.replace(/^(?:git|http):/, protocol)
    };
  }

  /**
   * Attempt to upgrade insecure protocols to secure protocol
   */
  static secureGitUrl(ref, hash, reporter) {
    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      if ((0, (_gitRefResolver || _load_gitRefResolver()).isCommitSha)(hash)) {
        // this is cryptographically secure
        return ref;
      }

      if (ref.protocol === 'git:') {
        const secureUrl = Git.replaceProtocol(ref, 'https:');
        if (yield Git.repoExists(secureUrl)) {
          return secureUrl;
        } else {
          reporter.warn(reporter.lang('downloadGitWithoutCommit', ref.repository));
          return ref;
        }
      }

      if (ref.protocol === 'http:') {
        const secureRef = Git.replaceProtocol(ref, 'https:');
        if (yield Git.repoExists(secureRef)) {
          return secureRef;
        } else {
          reporter.warn(reporter.lang('downloadHTTPWithoutCommit', ref.repository));
          return ref;
        }
      }

      return ref;
    })();
  }

  /**
   * Archive a repo to destination
   */

  archive(dest) {
    if (this.supportsArchive) {
      return this._archiveViaRemoteArchive(dest);
    } else {
      return this._archiveViaLocalFetched(dest);
    }
  }

  _archiveViaRemoteArchive(dest) {
    var _this = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const hashStream = new (_crypto || _load_crypto()).HashStream();
      yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['archive', `--remote=${_this.gitUrl.repository}`, _this.ref], {
        process(proc, resolve, reject, done) {
          const writeStream = (0, (_fs || _load_fs()).createWriteStream)(dest);
          proc.on('error', reject);
          writeStream.on('error', reject);
          writeStream.on('end', done);
          writeStream.on('open', function () {
            proc.stdout.pipe(hashStream).pipe(writeStream);
          });
          writeStream.once('finish', done);
        }
      });
      return hashStream.getHash();
    })();
  }

  _archiveViaLocalFetched(dest) {
    var _this2 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const hashStream = new (_crypto || _load_crypto()).HashStream();
      yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['archive', _this2.hash], {
        cwd: _this2.cwd,
        process(proc, resolve, reject, done) {
          const writeStream = (0, (_fs || _load_fs()).createWriteStream)(dest);
          proc.on('error', reject);
          writeStream.on('error', reject);
          writeStream.on('open', function () {
            proc.stdout.pipe(hashStream).pipe(writeStream);
          });
          writeStream.once('finish', done);
        }
      });
      return hashStream.getHash();
    })();
  }

  /**
   * Clone a repo to the input `dest`. Use `git archive` if it's available, otherwise fall
   * back to `git clone`.
   */

  clone(dest) {
    if (this.supportsArchive) {
      return this._cloneViaRemoteArchive(dest);
    } else {
      return this._cloneViaLocalFetched(dest);
    }
  }

  _cloneViaRemoteArchive(dest) {
    var _this3 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['archive', `--remote=${_this3.gitUrl.repository}`, _this3.ref], {
        process(proc, update, reject, done) {
          const extractor = (_tarFs || _load_tarFs()).default.extract(dest, {
            dmode: 0o555, // all dirs should be readable
            fmode: 0o444 // all files should be readable
          });
          extractor.on('error', reject);
          extractor.on('finish', done);

          proc.stdout.pipe(extractor);
          proc.on('error', reject);
        }
      });
    })();
  }

  _cloneViaLocalFetched(dest) {
    var _this4 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['archive', _this4.hash], {
        cwd: _this4.cwd,
        process(proc, resolve, reject, done) {
          const extractor = (_tarFs || _load_tarFs()).default.extract(dest, {
            dmode: 0o555, // all dirs should be readable
            fmode: 0o444 // all files should be readable
          });

          extractor.on('error', reject);
          extractor.on('finish', done);

          proc.stdout.pipe(extractor);
        }
      });
    })();
  }

  /**
   * Clone this repo.
   */

  fetch() {
    var _this5 = this;

    const gitUrl = this.gitUrl,
          cwd = this.cwd;


    return (_fs2 || _load_fs2()).lockQueue.push(gitUrl.repository, (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      if (yield (_fs2 || _load_fs2()).exists(cwd)) {
        yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['fetch', '--tags'], { cwd });
        yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['pull'], { cwd });
      } else {
        yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['clone', gitUrl.repository, cwd]);
      }

      _this5.fetched = true;
    }));
  }

  /**
   * Fetch the file by cloning the repo and reading it.
   */

  getFile(filename) {
    if (this.supportsArchive) {
      return this._getFileFromArchive(filename);
    } else {
      return this._getFileFromClone(filename);
    }
  }

  _getFileFromArchive(filename) {
    var _this6 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      try {
        return yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['archive', `--remote=${_this6.gitUrl.repository}`, _this6.ref, filename], {
          process(proc, update, reject, done) {
            const parser = (_tarStream || _load_tarStream()).default.extract();

            parser.on('error', reject);
            parser.on('finish', done);

            parser.on('entry', (header, stream, next) => {
              const decoder = new (_string_decoder || _load_string_decoder()).StringDecoder('utf8');
              let fileContent = '';

              stream.on('data', buffer => {
                fileContent += decoder.write(buffer);
              });
              stream.on('end', () => {
                const remaining = decoder.end();
                update(fileContent + remaining);
                next();
              });
              stream.resume();
            });

            proc.stdout.pipe(parser);
          }
        });
      } catch (err) {
        if (err.message.indexOf('did not match any files') >= 0) {
          return false;
        } else {
          throw err;
        }
      }
    })();
  }

  _getFileFromClone(filename) {
    var _this7 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      (0, (_invariant || _load_invariant()).default)(_this7.fetched, 'Repo not fetched');

      try {
        return yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['show', `${_this7.hash}:${filename}`], {
          cwd: _this7.cwd
        });
      } catch (err) {
        handleSpawnError(err);
        // file doesn't exist
        return false;
      }
    })();
  }

  /**
   * Initialize the repo, find a secure url to use and
   * set the ref to match an input `target`.
   */
  init() {
    var _this8 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      _this8.gitUrl = yield Git.secureGitUrl(_this8.gitUrl, _this8.hash, _this8.reporter);

      yield _this8.setRefRemote();

      // check capabilities
      if (_this8.ref !== '' && (yield Git.hasArchiveCapability(_this8.gitUrl))) {
        _this8.supportsArchive = true;
      } else {
        yield _this8.fetch();
      }

      return _this8.hash;
    })();
  }

  setRefRemote() {
    var _this9 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const isLocal = _this9.gitUrl.protocol === FILE_PROTOCOL;
      let stdout;

      if (isLocal) {
        stdout = yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['show-ref', '--tags', '--heads'], { cwd: _this9.gitUrl.repository });
      } else {
        stdout = yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['ls-remote', '--tags', '--heads', _this9.gitUrl.repository]);
      }

      const refs = (0, (_gitRefResolver || _load_gitRefResolver()).parseRefs)(stdout);
      return _this9.setRef(refs);
    })();
  }

  setRefHosted(hostedRefsList) {
    const refs = (0, (_gitRefResolver || _load_gitRefResolver()).parseRefs)(hostedRefsList);
    return this.setRef(refs);
  }

  /**
   * Resolves the default branch of a remote repository (not always "master")
   */

  resolveDefaultBranch() {
    var _this10 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      const isLocal = _this10.gitUrl.protocol === FILE_PROTOCOL;

      try {
        let stdout;
        if (isLocal) {
          stdout = yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['show-ref', 'HEAD'], { cwd: _this10.gitUrl.repository });
          const refs = (0, (_gitRefResolver || _load_gitRefResolver()).parseRefs)(stdout);
          const sha = refs.values().next().value;
          if (sha) {
            return { sha, ref: undefined };
          } else {
            throw new Error('Unable to find SHA for git HEAD');
          }
        } else {
          stdout = yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['ls-remote', '--symref', _this10.gitUrl.repository, 'HEAD']);
          const lines = stdout.split('\n').filter(validRef);

          var _lines$0$split = lines[0].split(/\s+/);

          const ref = _lines$0$split[1];

          var _lines$1$split = lines[1].split(/\s+/);

          const sha = _lines$1$split[0];

          return { sha, ref };
        }
      } catch (err) {
        handleSpawnError(err);
        // older versions of git don't support "--symref"
        const stdout = yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(['ls-remote', _this10.gitUrl.repository, 'HEAD']);
        const lines = stdout.split('\n').filter(validRef);

        var _lines$0$split2 = lines[0].split(/\s+/);

        const sha = _lines$0$split2[0];

        return { sha, ref: undefined };
      }
    })();
  }

  /**
   * Resolve a git commit to it's 40-chars format and ensure it exists in the repository
   * We need to use the 40-chars format to avoid multiple folders in the cache
   */

  resolveCommit(shaToResolve) {
    var _this11 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      try {
        yield _this11.fetch();
        const revListArgs = ['rev-list', '-n', '1', '--no-abbrev-commit', '--format=oneline', shaToResolve];
        const stdout = yield (0, (_gitSpawn || _load_gitSpawn()).spawn)(revListArgs, { cwd: _this11.cwd });

        var _stdout$split = stdout.split(/\s+/);

        const sha = _stdout$split[0];

        return { sha, ref: undefined };
      } catch (err) {
        handleSpawnError(err);
        // assuming commit not found, let's try something else
        return null;
      }
    })();
  }

  /**
   * Resolves the input hash / ref / semver range to a valid commit sha
   * If possible also resolves the sha to a valid ref in order to use "git archive"
   */

  setRef(refs) {
    var _this12 = this;

    return (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
      // get commit ref
      const version = _this12.hash;


      const resolvedResult = yield (0, (_gitRefResolver || _load_gitRefResolver()).resolveVersion)({
        config: _this12.config,
        git: _this12,
        version,
        refs
      });
      if (!resolvedResult) {
        throw new (_errors || _load_errors()).MessageError(_this12.reporter.lang('couldntFindMatch', version, Array.from(refs.keys()).join(','), _this12.gitUrl.repository));
      }

      _this12.hash = resolvedResult.sha;
      _this12.ref = resolvedResult.ref || '';
      return _this12.hash;
    })();
  }
}
exports.default = Git;