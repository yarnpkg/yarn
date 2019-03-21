'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.autoRun = exports.main = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let main = exports.main = (() => {
  var _ref = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* ({
    startArgs,
    args,
    endArgs
  }) {
    const collect = function collect(val, acc) {
      acc.push(val);
      return acc;
    };

    (0, (_loudRejection || _load_loudRejection()).default)();
    (0, (_signalHandler || _load_signalHandler()).default)();

    // set global options
    (_commander || _load_commander()).default.version((_yarnVersion || _load_yarnVersion()).version, '-v, --version');
    (_commander || _load_commander()).default.usage('[command] [flags]');
    (_commander || _load_commander()).default.option('--no-default-rc', 'prevent Yarn from automatically detecting yarnrc and npmrc files');
    (_commander || _load_commander()).default.option('--use-yarnrc <path>', 'specifies a yarnrc file that Yarn should use (.yarnrc only, not .npmrc)', collect, []);
    (_commander || _load_commander()).default.option('--verbose', 'output verbose messages on internal operations');
    (_commander || _load_commander()).default.option('--offline', 'trigger an error if any required dependencies are not available in local cache');
    (_commander || _load_commander()).default.option('--prefer-offline', 'use network only if dependencies are not available in local cache');
    (_commander || _load_commander()).default.option('--enable-pnp, --pnp', "enable the Plug'n'Play installation");
    (_commander || _load_commander()).default.option('--disable-pnp', "disable the Plug'n'Play installation");
    (_commander || _load_commander()).default.option('--strict-semver');
    (_commander || _load_commander()).default.option('--json', 'format Yarn log messages as lines of JSON (see jsonlines.org)');
    (_commander || _load_commander()).default.option('--ignore-scripts', "don't run lifecycle scripts");
    (_commander || _load_commander()).default.option('--har', 'save HAR output of network traffic');
    (_commander || _load_commander()).default.option('--ignore-platform', 'ignore platform checks');
    (_commander || _load_commander()).default.option('--ignore-engines', 'ignore engines check');
    (_commander || _load_commander()).default.option('--ignore-optional', 'ignore optional dependencies');
    (_commander || _load_commander()).default.option('--force', 'install and build packages even if they were built before, overwrite lockfile');
    (_commander || _load_commander()).default.option('--skip-integrity-check', 'run install without checking if node_modules is installed');
    (_commander || _load_commander()).default.option('--check-files', 'install will verify file tree of packages for consistency');
    (_commander || _load_commander()).default.option('--no-bin-links', "don't generate bin links when setting up packages");
    (_commander || _load_commander()).default.option('--flat', 'only allow one version of a package');
    (_commander || _load_commander()).default.option('--prod, --production [prod]', '', (_conversion || _load_conversion()).boolify);
    (_commander || _load_commander()).default.option('--no-lockfile', "don't read or generate a lockfile");
    (_commander || _load_commander()).default.option('--pure-lockfile', "don't generate a lockfile");
    (_commander || _load_commander()).default.option('--frozen-lockfile', "don't generate a lockfile and fail if an update is needed");
    (_commander || _load_commander()).default.option('--update-checksums', 'update package checksums from current repository');
    (_commander || _load_commander()).default.option('--link-duplicates', 'create hardlinks to the repeated modules in node_modules');
    (_commander || _load_commander()).default.option('--link-folder <path>', 'specify a custom folder to store global links');
    (_commander || _load_commander()).default.option('--global-folder <path>', 'specify a custom folder to store global packages');
    (_commander || _load_commander()).default.option('--modules-folder <path>', 'rather than installing modules into the node_modules folder relative to the cwd, output them here');
    (_commander || _load_commander()).default.option('--preferred-cache-folder <path>', 'specify a custom folder to store the yarn cache if possible');
    (_commander || _load_commander()).default.option('--cache-folder <path>', 'specify a custom folder that must be used to store the yarn cache');
    (_commander || _load_commander()).default.option('--mutex <type>[:specifier]', 'use a mutex to ensure only one yarn instance is executing');
    (_commander || _load_commander()).default.option('--emoji [bool]', 'enable emoji in output', (_conversion || _load_conversion()).boolify, process.platform === 'darwin' || process.env.TERM_PROGRAM === 'Hyper' || process.env.TERM_PROGRAM === 'HyperTerm' || process.env.TERM_PROGRAM === 'Terminus');
    (_commander || _load_commander()).default.option('-s, --silent', 'skip Yarn console logs, other types of logs (script output) will be printed');
    (_commander || _load_commander()).default.option('--cwd <cwd>', 'working directory to use', process.cwd());
    (_commander || _load_commander()).default.option('--proxy <host>', '');
    (_commander || _load_commander()).default.option('--https-proxy <host>', '');
    (_commander || _load_commander()).default.option('--registry <url>', 'override configuration registry');
    (_commander || _load_commander()).default.option('--no-progress', 'disable progress bar');
    (_commander || _load_commander()).default.option('--network-concurrency <number>', 'maximum number of concurrent network requests', parseInt);
    (_commander || _load_commander()).default.option('--network-timeout <milliseconds>', 'TCP timeout for network requests', parseInt);
    (_commander || _load_commander()).default.option('--non-interactive', 'do not show interactive prompts');
    (_commander || _load_commander()).default.option('--scripts-prepend-node-path [bool]', 'prepend the node executable dir to the PATH in scripts', (_conversion || _load_conversion()).boolify);
    (_commander || _load_commander()).default.option('--no-node-version-check', 'do not warn when using a potentially unsupported Node version');
    (_commander || _load_commander()).default.option('--focus', 'Focus on a single workspace by installing remote copies of its sibling workspaces.');
    (_commander || _load_commander()).default.option('--otp <otpcode>', 'one-time password for two factor authentication');

    // if -v is the first command, then always exit after returning the version
    if (args[0] === '-v') {
      console.log((_yarnVersion || _load_yarnVersion()).version.trim());
      process.exitCode = 0;
      return;
    }

    // get command name
    const firstNonFlagIndex = args.findIndex(function (arg, idx, arr) {
      const isOption = arg.startsWith('-');
      const prev = idx > 0 && arr[idx - 1];
      const prevOption = prev && prev.startsWith('-') && (_commander || _load_commander()).default.optionFor(prev);
      const boundToPrevOption = prevOption && (prevOption.optional || prevOption.required);

      return !isOption && !boundToPrevOption;
    });
    let preCommandArgs;
    let commandName = '';
    if (firstNonFlagIndex > -1) {
      preCommandArgs = args.slice(0, firstNonFlagIndex);
      commandName = args[firstNonFlagIndex];
      args = args.slice(firstNonFlagIndex + 1);
    } else {
      preCommandArgs = args;
      args = [];
    }

    let isKnownCommand = Object.prototype.hasOwnProperty.call((_index3 || _load_index3()).default, commandName);
    const isHelp = function isHelp(arg) {
      return arg === '--help' || arg === '-h';
    };
    const helpInPre = preCommandArgs.findIndex(isHelp);
    const helpInArgs = args.findIndex(isHelp);
    const setHelpMode = function setHelpMode() {
      if (isKnownCommand) {
        args.unshift(commandName);
      }
      commandName = 'help';
      isKnownCommand = true;
    };

    if (helpInPre > -1) {
      preCommandArgs.splice(helpInPre);
      setHelpMode();
    } else if (isKnownCommand && helpInArgs === 0) {
      args.splice(helpInArgs);
      setHelpMode();
    }

    if (!commandName) {
      commandName = 'install';
      isKnownCommand = true;
    }

    if (!isKnownCommand) {
      // if command is not recognized, then set default to `run`
      args.unshift(commandName);
      commandName = 'run';
    }
    const command = (_index3 || _load_index3()).default[commandName];

    let warnAboutRunDashDash = false;
    // we are using "yarn <script> -abc", "yarn run <script> -abc", or "yarn node -abc", we want -abc
    // to be script options, not yarn options
    const PROXY_COMMANDS = new Set([`run`, `create`, `node`]);
    if (PROXY_COMMANDS.has(commandName)) {
      if (endArgs.length === 0) {
        let preservedArgs = 0;
        // the "run" and "create" command take one argument that we want to parse as usual (the
        // script/package name), hence the splice(1)
        if (command === (_index3 || _load_index3()).default.run || command === (_index3 || _load_index3()).default.create) {
          preservedArgs += 1;
        }
        // If the --into option immediately follows the command (or the script name in the "run/create"
        // case), we parse them as regular options so that we can cd into them
        if (args[preservedArgs] === `--into`) {
          preservedArgs += 2;
        }
        endArgs = ['--', ...args.splice(preservedArgs)];
      } else {
        warnAboutRunDashDash = true;
      }
    }

    (_commander || _load_commander()).default.originalArgs = args;
    args = [...preCommandArgs, ...args];

    command.setFlags((_commander || _load_commander()).default);
    (_commander || _load_commander()).default.parse([...startArgs,
    // we use this for https://github.com/tj/commander.js/issues/346, otherwise
    // it will strip some args that match with any options
    'this-arg-will-get-stripped-later', ...(0, (_rc || _load_rc()).getRcArgs)(commandName, args), ...args]);
    (_commander || _load_commander()).default.args = (_commander || _load_commander()).default.args.concat(endArgs.slice(1));

    // we strip cmd
    console.assert((_commander || _load_commander()).default.args.length >= 1);
    console.assert((_commander || _load_commander()).default.args[0] === 'this-arg-will-get-stripped-later');
    (_commander || _load_commander()).default.args.shift();

    //
    const Reporter = (_commander || _load_commander()).default.json ? (_index || _load_index()).JSONReporter : (_index || _load_index()).ConsoleReporter;
    const reporter = new Reporter({
      emoji: process.stdout.isTTY && (_commander || _load_commander()).default.emoji,
      verbose: (_commander || _load_commander()).default.verbose,
      noProgress: !(_commander || _load_commander()).default.progress,
      isSilent: (0, (_conversion || _load_conversion()).boolifyWithDefault)(process.env.YARN_SILENT, false) || (_commander || _load_commander()).default.silent,
      nonInteractive: (_commander || _load_commander()).default.nonInteractive
    });

    const exit = function exit(exitCode) {
      process.exitCode = exitCode || 0;
      reporter.close();
    };

    reporter.initPeakMemoryCounter();

    const config = new (_config || _load_config()).default(reporter);
    const outputWrapperEnabled = (0, (_conversion || _load_conversion()).boolifyWithDefault)(process.env.YARN_WRAP_OUTPUT, true);
    const shouldWrapOutput = outputWrapperEnabled && !(_commander || _load_commander()).default.json && command.hasWrapper((_commander || _load_commander()).default, (_commander || _load_commander()).default.args);

    if (shouldWrapOutput) {
      reporter.header(commandName, { name: 'yarn', version: (_yarnVersion || _load_yarnVersion()).version });
    }

    if ((_commander || _load_commander()).default.nodeVersionCheck && !(_semver || _load_semver()).default.satisfies(process.versions.node, (_constants || _load_constants()).SUPPORTED_NODE_VERSIONS)) {
      reporter.warn(reporter.lang('unsupportedNodeVersion', process.versions.node, (_constants || _load_constants()).SUPPORTED_NODE_VERSIONS));
    }

    if (command.noArguments && (_commander || _load_commander()).default.args.length) {
      reporter.error(reporter.lang('noArguments'));
      reporter.info(command.getDocsInfo);
      exit(1);
      return;
    }

    //
    if ((_commander || _load_commander()).default.yes) {
      reporter.warn(reporter.lang('yesWarning'));
    }

    //
    if (!(_commander || _load_commander()).default.offline && (_network || _load_network()).isOffline()) {
      reporter.warn(reporter.lang('networkWarning'));
    }

    //
    const run = function run() {
      (0, (_invariant || _load_invariant()).default)(command, 'missing command');

      if (warnAboutRunDashDash) {
        reporter.warn(reporter.lang('dashDashDeprecation'));
      }

      return command.run(config, reporter, (_commander || _load_commander()).default, (_commander || _load_commander()).default.args).then(function (exitCode) {
        if (shouldWrapOutput) {
          reporter.footer(false);
        }
        return exitCode;
      });
    };

    //
    const runEventuallyWithFile = function runEventuallyWithFile(mutexFilename, isFirstTime) {
      return new Promise(function (resolve) {
        const lockFilename = mutexFilename || (_path || _load_path()).default.join(config.cwd, (_constants || _load_constants()).SINGLE_INSTANCE_FILENAME);
        (_properLockfile || _load_properLockfile()).default.lock(lockFilename, { realpath: false }, function (err, release) {
          if (err) {
            if (isFirstTime) {
              reporter.warn(reporter.lang('waitingInstance'));
            }
            setTimeout(function () {
              resolve(runEventuallyWithFile(mutexFilename, false));
            }, 200); // do not starve the CPU
          } else {
            (0, (_death || _load_death()).default)(function () {
              process.exitCode = 1;
            });
            resolve(run().then(function () {
              return new Promise(function (resolve) {
                return release(resolve);
              });
            }));
          }
        });
      });
    };

    const runEventuallyWithNetwork = function runEventuallyWithNetwork(mutexPort) {
      return new Promise(function (resolve, reject) {
        const connectionOptions = {
          port: +mutexPort || (_constants || _load_constants()).SINGLE_INSTANCE_PORT,
          host: 'localhost'
        };

        function startServer() {
          const clients = new Set();
          const server = (_http || _load_http()).default.createServer(manager);

          // The server must not prevent us from exiting
          server.unref();

          // No socket must timeout, so that they aren't closed before we exit
          server.timeout = 0;

          // If we fail to setup the server, we ask the existing one for its name
          server.on('error', () => {
            reportServerName();
          });

          // If we succeed, keep track of all the connected sockets to close them later
          server.on('connection', socket => {
            clients.add(socket);
            socket.on('close', () => {
              clients.delete(socket);
            });
          });

          server.listen(connectionOptions, () => {
            // Don't forget to kill the sockets if we're being killed via signals
            (0, (_death || _load_death()).default)(killSockets);

            // Also kill the sockets if we finish, whether it's a success or a failure
            run().then(res => {
              killSockets();
              resolve(res);
            }, err => {
              killSockets();
              reject(err);
            });
          });

          function manager(request, response) {
            response.writeHead(200);
            response.end(JSON.stringify({ cwd: config.cwd, pid: process.pid }));
          }

          function killSockets() {
            try {
              server.close();
            } catch (err) {
              // best effort
            }

            for (var _iterator = clients, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
              var _ref2;

              if (_isArray) {
                if (_i >= _iterator.length) break;
                _ref2 = _iterator[_i++];
              } else {
                _i = _iterator.next();
                if (_i.done) break;
                _ref2 = _i.value;
              }

              const socket = _ref2;

              try {
                socket.destroy();
              } catch (err) {
                // best effort
              }
            }

            // If the process hasn't exited in the next 5s, it has stalled and we abort
            const timeout = setTimeout(() => {
              console.error('Process stalled');
              if (process._getActiveHandles) {
                console.error('Active handles:');
                // $FlowFixMe: getActiveHandles is undocumented, but it exists
                for (var _iterator2 = process._getActiveHandles(), _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
                  var _ref3;

                  if (_isArray2) {
                    if (_i2 >= _iterator2.length) break;
                    _ref3 = _iterator2[_i2++];
                  } else {
                    _i2 = _iterator2.next();
                    if (_i2.done) break;
                    _ref3 = _i2.value;
                  }

                  const handle = _ref3;

                  console.error(`  - ${handle.constructor.name}`);
                }
              }
              // eslint-disable-next-line no-process-exit
              process.exit(1);
            }, 5000);

            // This timeout must not prevent us from exiting
            // $FlowFixMe: Node's setTimeout returns a Timeout, not a Number
            timeout.unref();
          }
        }

        function reportServerName() {
          const request = (_http || _load_http()).default.get(connectionOptions, response => {
            const buffers = [];

            response.on('data', buffer => {
              buffers.push(buffer);
            });

            response.on('end', () => {
              try {
                var _JSON$parse = JSON.parse(Buffer.concat(buffers).toString());

                const cwd = _JSON$parse.cwd,
                      pid = _JSON$parse.pid;

                reporter.warn(reporter.lang('waitingNamedInstance', pid, cwd));
              } catch (error) {
                reporter.verbose(error);
                reject(new Error(reporter.lang('mutexPortBusy', connectionOptions.port)));
                return;
              }
              waitForTheNetwork();
            });

            response.on('error', () => {
              startServer();
            });
          });

          request.on('error', () => {
            startServer();
          });
        }

        function waitForTheNetwork() {
          const socket = (_net || _load_net()).default.createConnection(connectionOptions);

          socket.on('error', () => {
            // catch & ignore, the retry is handled in 'close'
          });

          socket.on('close', () => {
            startServer();
          });
        }

        startServer();
      });
    };

    function onUnexpectedError(err) {
      function indent(str) {
        return '\n  ' + str.trim().split('\n').join('\n  ');
      }

      const log = [];
      log.push(`Arguments: ${indent(process.argv.join(' '))}`);
      log.push(`PATH: ${indent(process.env.PATH || 'undefined')}`);
      log.push(`Yarn version: ${indent((_yarnVersion || _load_yarnVersion()).version)}`);
      log.push(`Node version: ${indent(process.versions.node)}`);
      log.push(`Platform: ${indent(process.platform + ' ' + process.arch)}`);

      log.push(`Trace: ${indent(err.stack)}`);

      // add manifests
      for (var _iterator3 = (_index2 || _load_index2()).registryNames, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
        var _ref4;

        if (_isArray3) {
          if (_i3 >= _iterator3.length) break;
          _ref4 = _iterator3[_i3++];
        } else {
          _i3 = _iterator3.next();
          if (_i3.done) break;
          _ref4 = _i3.value;
        }

        const registryName = _ref4;

        const possibleLoc = (_path || _load_path()).default.join(config.cwd, (_index2 || _load_index2()).registries[registryName].filename);
        const manifest = (_fs || _load_fs()).default.existsSync(possibleLoc) ? (_fs || _load_fs()).default.readFileSync(possibleLoc, 'utf8') : 'No manifest';
        log.push(`${registryName} manifest: ${indent(manifest)}`);
      }

      // lockfile
      const lockLoc = (_path || _load_path()).default.join(config.lockfileFolder || config.cwd, // lockfileFolder might not be set at this point
      (_constants || _load_constants()).LOCKFILE_FILENAME);
      const lockfile = (_fs || _load_fs()).default.existsSync(lockLoc) ? (_fs || _load_fs()).default.readFileSync(lockLoc, 'utf8') : 'No lockfile';
      log.push(`Lockfile: ${indent(lockfile)}`);

      const errorReportLoc = writeErrorReport(log);

      reporter.error(reporter.lang('unexpectedError', err.message));

      if (errorReportLoc) {
        reporter.info(reporter.lang('bugReport', errorReportLoc));
      }
    }

    function writeErrorReport(log) {
      const errorReportLoc = config.enableMetaFolder ? (_path || _load_path()).default.join(config.cwd, (_constants || _load_constants()).META_FOLDER, 'yarn-error.log') : (_path || _load_path()).default.join(config.cwd, 'yarn-error.log');

      try {
        (_fs || _load_fs()).default.writeFileSync(errorReportLoc, log.join('\n\n') + '\n');
      } catch (err) {
        reporter.error(reporter.lang('fileWriteError', errorReportLoc, err.message));
        return undefined;
      }

      return errorReportLoc;
    }

    const cwd = command.shouldRunInCurrentCwd ? (_commander || _load_commander()).default.cwd : findProjectRoot((_commander || _load_commander()).default.cwd);

    yield config.init({
      cwd,
      commandName,

      enablePnp: (_commander || _load_commander()).default.pnp,
      disablePnp: (_commander || _load_commander()).default.disablePnp,
      enableDefaultRc: (_commander || _load_commander()).default.defaultRc,
      extraneousYarnrcFiles: (_commander || _load_commander()).default.useYarnrc,
      binLinks: (_commander || _load_commander()).default.binLinks,
      modulesFolder: (_commander || _load_commander()).default.modulesFolder,
      linkFolder: (_commander || _load_commander()).default.linkFolder,
      globalFolder: (_commander || _load_commander()).default.globalFolder,
      preferredCacheFolder: (_commander || _load_commander()).default.preferredCacheFolder,
      cacheFolder: (_commander || _load_commander()).default.cacheFolder,
      preferOffline: (_commander || _load_commander()).default.preferOffline,
      captureHar: (_commander || _load_commander()).default.har,
      ignorePlatform: (_commander || _load_commander()).default.ignorePlatform,
      ignoreEngines: (_commander || _load_commander()).default.ignoreEngines,
      ignoreScripts: (_commander || _load_commander()).default.ignoreScripts,
      offline: (_commander || _load_commander()).default.preferOffline || (_commander || _load_commander()).default.offline,
      looseSemver: !(_commander || _load_commander()).default.strictSemver,
      production: (_commander || _load_commander()).default.production,
      httpProxy: (_commander || _load_commander()).default.proxy,
      httpsProxy: (_commander || _load_commander()).default.httpsProxy,
      registry: (_commander || _load_commander()).default.registry,
      networkConcurrency: (_commander || _load_commander()).default.networkConcurrency,
      networkTimeout: (_commander || _load_commander()).default.networkTimeout,
      nonInteractive: (_commander || _load_commander()).default.nonInteractive,
      updateChecksums: (_commander || _load_commander()).default.updateChecksums,
      focus: (_commander || _load_commander()).default.focus,
      otp: (_commander || _load_commander()).default.otp
    }).then(function () {
      // lockfile check must happen after config.init sets lockfileFolder
      if (command.requireLockfile && !(_fs || _load_fs()).default.existsSync((_path || _load_path()).default.join(config.lockfileFolder, (_constants || _load_constants()).LOCKFILE_FILENAME))) {
        throw new (_errors || _load_errors()).MessageError(reporter.lang('noRequiredLockfile'));
      }

      // option "no-progress" stored in yarn config
      const noProgressConfig = config.registries.yarn.getOption('no-progress');

      if (noProgressConfig) {
        reporter.disableProgress();
      }

      // verbose logs outputs process.uptime() with this line we can sync uptime to absolute time on the computer
      reporter.verbose(`current time: ${new Date().toISOString()}`);

      const mutex = (_commander || _load_commander()).default.mutex;
      if (mutex && typeof mutex === 'string') {
        const separatorLoc = mutex.indexOf(':');
        let mutexType;
        let mutexSpecifier;
        if (separatorLoc === -1) {
          mutexType = mutex;
          mutexSpecifier = undefined;
        } else {
          mutexType = mutex.substring(0, separatorLoc);
          mutexSpecifier = mutex.substring(separatorLoc + 1);
        }

        if (mutexType === 'file') {
          return runEventuallyWithFile(mutexSpecifier, true).then(exit);
        } else if (mutexType === 'network') {
          return runEventuallyWithNetwork(mutexSpecifier).then(exit);
        } else {
          throw new (_errors || _load_errors()).MessageError(`Unknown single instance type ${mutexType}`);
        }
      } else {
        return run().then(exit);
      }
    }).catch(function (err) {
      reporter.verbose(err.stack);

      if (err instanceof (_errors || _load_errors()).MessageError) {
        reporter.error(err.message);
      } else {
        onUnexpectedError(err);
      }

      if (command.getDocsInfo) {
        reporter.info(command.getDocsInfo);
      }

      if (err instanceof (_errors2 || _load_errors2()).ProcessTermError) {
        return exit(err.EXIT_CODE || 1);
      }

      return exit(1);
    });
  });

  return function main(_x) {
    return _ref.apply(this, arguments);
  };
})();

let start = (() => {
  var _ref5 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* () {
    const rc = (0, (_rc || _load_rc()).getRcConfigForCwd)(process.cwd(), process.argv.slice(2));
    const yarnPath = rc['yarn-path'];

    if (yarnPath && !(0, (_conversion || _load_conversion()).boolifyWithDefault)(process.env.YARN_IGNORE_PATH, false)) {
      const argv = process.argv.slice(2);
      const opts = { stdio: 'inherit', env: Object.assign({}, process.env, { YARN_IGNORE_PATH: 1 }) };
      let exitCode = 0;

      try {
        exitCode = yield (0, (_child || _load_child()).spawnp)(yarnPath, argv, opts);
      } catch (firstError) {
        try {
          exitCode = yield (0, (_child || _load_child()).forkp)(yarnPath, argv, opts);
        } catch (error) {
          throw firstError;
        }
      }

      process.exitCode = exitCode;
    } else {
      // ignore all arguments after a --
      const doubleDashIndex = process.argv.findIndex(function (element) {
        return element === '--';
      });
      const startArgs = process.argv.slice(0, 2);
      const args = process.argv.slice(2, doubleDashIndex === -1 ? process.argv.length : doubleDashIndex);
      const endArgs = doubleDashIndex === -1 ? [] : process.argv.slice(doubleDashIndex);

      yield main({ startArgs, args, endArgs });
    }
  });

  return function start() {
    return _ref5.apply(this, arguments);
  };
})();

// When this module is compiled via Webpack, its child
// count will be 0 since it is a single-file bundle.


var _http;

function _load_http() {
  return _http = _interopRequireDefault(require('http'));
}

var _net;

function _load_net() {
  return _net = _interopRequireDefault(require('net'));
}

var _path;

function _load_path() {
  return _path = _interopRequireDefault(require('path'));
}

var _commander;

function _load_commander() {
  return _commander = _interopRequireDefault(require('commander'));
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireDefault(require('fs'));
}

var _invariant;

function _load_invariant() {
  return _invariant = _interopRequireDefault(require('invariant'));
}

var _properLockfile;

function _load_properLockfile() {
  return _properLockfile = _interopRequireDefault(require('proper-lockfile'));
}

var _loudRejection;

function _load_loudRejection() {
  return _loudRejection = _interopRequireDefault(require('loud-rejection'));
}

var _death;

function _load_death() {
  return _death = _interopRequireDefault(require('death'));
}

var _semver;

function _load_semver() {
  return _semver = _interopRequireDefault(require('semver'));
}

var _index;

function _load_index() {
  return _index = require('../reporters/index.js');
}

var _index2;

function _load_index2() {
  return _index2 = require('../registries/index.js');
}

var _index3;

function _load_index3() {
  return _index3 = _interopRequireDefault(require('./commands/index.js'));
}

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('../constants.js'));
}

var _network;

function _load_network() {
  return _network = _interopRequireWildcard(require('../util/network.js'));
}

var _errors;

function _load_errors() {
  return _errors = require('../errors.js');
}

var _config;

function _load_config() {
  return _config = _interopRequireDefault(require('../config.js'));
}

var _rc;

function _load_rc() {
  return _rc = require('../rc.js');
}

var _child;

function _load_child() {
  return _child = require('../util/child.js');
}

var _yarnVersion;

function _load_yarnVersion() {
  return _yarnVersion = require('../util/yarn-version.js');
}

var _signalHandler;

function _load_signalHandler() {
  return _signalHandler = _interopRequireDefault(require('../util/signal-handler.js'));
}

var _conversion;

function _load_conversion() {
  return _conversion = require('../util/conversion.js');
}

var _errors2;

function _load_errors2() {
  return _errors2 = require('../errors');
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function findProjectRoot(base) {
  let prev = null;
  let dir = base;

  do {
    if ((_fs || _load_fs()).default.existsSync((_path || _load_path()).default.join(dir, (_constants || _load_constants()).NODE_PACKAGE_JSON))) {
      return dir;
    }

    prev = dir;
    dir = (_path || _load_path()).default.dirname(dir);
  } while (dir !== prev);

  return base;
}

const autoRun = exports.autoRun = module.children.length === 0;

if (require.main === module) {
  start().catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

exports.default = start;