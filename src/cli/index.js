/* @flow */

import http from 'http';
import net from 'net';
import path from 'path';

import commander from 'commander';
import fs from 'fs';
import invariant from 'invariant';
import lockfile from 'proper-lockfile';
import loudRejection from 'loud-rejection';
import onDeath from 'death';
import semver from 'semver';

import {ConsoleReporter, JSONReporter} from '../reporters/index.js';
import {registries, registryNames} from '../registries/index.js';
import commands from './commands/index.js';
import * as constants from '../constants.js';
import * as network from '../util/network.js';
import {MessageError} from '../errors.js';
import Config from '../config.js';
import {getRcConfigForCwd, getRcArgs} from '../rc.js';
import {spawnp, forkp} from '../util/child.js';
import {version} from '../util/yarn-version.js';
import handleSignals from '../util/signal-handler.js';
import {boolify, boolifyWithDefault} from '../util/conversion.js';

function findProjectRoot(base: string): string {
  let prev = null;
  let dir = base;

  do {
    if (fs.existsSync(path.join(dir, constants.NODE_PACKAGE_JSON))) {
      return dir;
    }

    prev = dir;
    dir = path.dirname(dir);
  } while (dir !== prev);

  return base;
}

export async function main({
  startArgs,
  args,
  endArgs,
}: {
  startArgs: Array<string>,
  args: Array<string>,
  endArgs: Array<string>,
}): Promise<void> {
  const collect = (val, acc) => {
    acc.push(val);
    return acc;
  };

  loudRejection();
  handleSignals();

  // set global options
  commander.version(version, '-v, --version');
  commander.usage('[command] [flags]');
  commander.option('--no-default-rc', 'prevent Yarn from automatically detecting yarnrc and npmrc files');
  commander.option(
    '--use-yarnrc <path>',
    'specifies a yarnrc file that Yarn should use (.yarnrc only, not .npmrc)',
    collect,
    [],
  );
  commander.option('--verbose', 'output verbose messages on internal operations');
  commander.option('--offline', 'trigger an error if any required dependencies are not available in local cache');
  commander.option('--prefer-offline', 'use network only if dependencies are not available in local cache');
  commander.option('--enable-pnp, --pnp', "enable the Plug'n'Play installation");
  commander.option('--disable-pnp', "disable the Plug'n'Play installation");
  commander.option('--strict-semver');
  commander.option('--json', 'format Yarn log messages as lines of JSON (see jsonlines.org)');
  commander.option('--ignore-scripts', "don't run lifecycle scripts");
  commander.option('--har', 'save HAR output of network traffic');
  commander.option('--ignore-platform', 'ignore platform checks');
  commander.option('--ignore-engines', 'ignore engines check');
  commander.option('--ignore-optional', 'ignore optional dependencies');
  commander.option('--force', 'install and build packages even if they were built before, overwrite lockfile');
  commander.option('--skip-integrity-check', 'run install without checking if node_modules is installed');
  commander.option('--check-files', 'install will verify file tree of packages for consistency');
  commander.option('--no-bin-links', "don't generate bin links when setting up packages");
  commander.option('--flat', 'only allow one version of a package');
  commander.option('--prod, --production [prod]', '', boolify);
  commander.option('--no-lockfile', "don't read or generate a lockfile");
  commander.option('--pure-lockfile', "don't generate a lockfile");
  commander.option('--frozen-lockfile', "don't generate a lockfile and fail if an update is needed");
  commander.option('--update-checksums', 'update package checksums from current repository');
  commander.option('--link-duplicates', 'create hardlinks to the repeated modules in node_modules');
  commander.option('--link-folder <path>', 'specify a custom folder to store global links');
  commander.option('--global-folder <path>', 'specify a custom folder to store global packages');
  commander.option(
    '--modules-folder <path>',
    'rather than installing modules into the node_modules folder relative to the cwd, output them here',
  );
  commander.option('--preferred-cache-folder <path>', 'specify a custom folder to store the yarn cache if possible');
  commander.option('--cache-folder <path>', 'specify a custom folder that must be used to store the yarn cache');
  commander.option('--mutex <type>[:specifier]', 'use a mutex to ensure only one yarn instance is executing');
  commander.option(
    '--emoji [bool]',
    'enable emoji in output',
    boolify,
    process.platform === 'darwin' || process.env.TERM_PROGRAM === 'Hyper' || process.env.TERM_PROGRAM === 'HyperTerm',
  );
  commander.option('-s, --silent', 'skip Yarn console logs, other types of logs (script output) will be printed');
  commander.option('--cwd <cwd>', 'working directory to use', process.cwd());
  commander.option('--proxy <host>', '');
  commander.option('--https-proxy <host>', '');
  commander.option('--registry <url>', 'override configuration registry');
  commander.option('--no-progress', 'disable progress bar');
  commander.option('--network-concurrency <number>', 'maximum number of concurrent network requests', parseInt);
  commander.option('--network-timeout <milliseconds>', 'TCP timeout for network requests', parseInt);
  commander.option('--non-interactive', 'do not show interactive prompts');
  commander.option(
    '--scripts-prepend-node-path [bool]',
    'prepend the node executable dir to the PATH in scripts',
    boolify,
  );
  commander.option('--no-node-version-check', 'do not warn when using a potentially unsupported Node version');
  commander.option('--focus', 'Focus on a single workspace by installing remote copies of its sibling workspaces.');
  commander.option('--otp <otpcode>', 'one-time password for two factor authentication');

  // if -v is the first command, then always exit after returning the version
  if (args[0] === '-v') {
    console.log(version.trim());
    process.exitCode = 0;
    return;
  }

  // get command name
  const firstNonFlagIndex = args.findIndex((arg, idx, arr) => {
    const isOption = arg.startsWith('-');
    const prev = idx > 0 && arr[idx - 1];
    const prevOption = prev && prev.startsWith('-') && commander.optionFor(prev);
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

  let isKnownCommand = Object.prototype.hasOwnProperty.call(commands, commandName);
  const isHelp = arg => arg === '--help' || arg === '-h';
  const helpInPre = preCommandArgs.findIndex(isHelp);
  const helpInArgs = args.findIndex(isHelp);
  const setHelpMode = () => {
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
  const command = commands[commandName];

  let warnAboutRunDashDash = false;
  // we are using "yarn <script> -abc", "yarn run <script> -abc", or "yarn node -abc", we want -abc
  // to be script options, not yarn options
  const PROXY_COMMANDS = new Set([`run`, `create`, `node`]);
  if (PROXY_COMMANDS.has(commandName)) {
    if (endArgs.length === 0) {
      let preservedArgs = 0;
      // the "run" and "create" command take one argument that we want to parse as usual (the
      // script/package name), hence the splice(1)
      if (command === commands.run || command === commands.create) {
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

  commander.originalArgs = args;
  args = [...preCommandArgs, ...args];

  command.setFlags(commander);
  commander.parse([
    ...startArgs,
    // we use this for https://github.com/tj/commander.js/issues/346, otherwise
    // it will strip some args that match with any options
    'this-arg-will-get-stripped-later',
    ...getRcArgs(commandName, args),
    ...args,
  ]);
  commander.args = commander.args.concat(endArgs.slice(1));

  // we strip cmd
  console.assert(commander.args.length >= 1);
  console.assert(commander.args[0] === 'this-arg-will-get-stripped-later');
  commander.args.shift();

  //
  const Reporter = commander.json ? JSONReporter : ConsoleReporter;
  const reporter = new Reporter({
    emoji: process.stdout.isTTY && commander.emoji,
    verbose: commander.verbose,
    noProgress: !commander.progress,
    isSilent: boolifyWithDefault(process.env.YARN_SILENT, false) || commander.silent,
    nonInteractive: commander.nonInteractive,
  });

  const exit = exitCode => {
    process.exitCode = exitCode || 0;
    reporter.close();
  };

  reporter.initPeakMemoryCounter();

  const config = new Config(reporter);
  const outputWrapperEnabled = boolifyWithDefault(process.env.YARN_WRAP_OUTPUT, true);
  const shouldWrapOutput = outputWrapperEnabled && !commander.json && command.hasWrapper(commander, commander.args);

  if (shouldWrapOutput) {
    reporter.header(commandName, {name: 'yarn', version});
  }

  if (commander.nodeVersionCheck && !semver.satisfies(process.versions.node, constants.SUPPORTED_NODE_VERSIONS)) {
    reporter.warn(reporter.lang('unsupportedNodeVersion', process.versions.node, constants.SUPPORTED_NODE_VERSIONS));
  }

  if (command.noArguments && commander.args.length) {
    reporter.error(reporter.lang('noArguments'));
    reporter.info(command.getDocsInfo);
    exit(1);
    return;
  }

  //
  if (commander.yes) {
    reporter.warn(reporter.lang('yesWarning'));
  }

  //
  if (!commander.offline && network.isOffline()) {
    reporter.warn(reporter.lang('networkWarning'));
  }

  //
  const run = (): Promise<void> => {
    invariant(command, 'missing command');

    if (warnAboutRunDashDash) {
      reporter.warn(reporter.lang('dashDashDeprecation'));
    }

    return command.run(config, reporter, commander, commander.args).then(exitCode => {
      if (shouldWrapOutput) {
        reporter.footer(false);
      }
      return exitCode;
    });
  };

  //
  const runEventuallyWithFile = (mutexFilename: ?string, isFirstTime?: boolean): Promise<void> => {
    return new Promise(resolve => {
      const lockFilename = mutexFilename || path.join(config.cwd, constants.SINGLE_INSTANCE_FILENAME);
      lockfile.lock(lockFilename, {realpath: false}, (err: mixed, release: () => void) => {
        if (err) {
          if (isFirstTime) {
            reporter.warn(reporter.lang('waitingInstance'));
          }
          setTimeout(() => {
            resolve(runEventuallyWithFile(mutexFilename, false));
          }, 200); // do not starve the CPU
        } else {
          onDeath(() => {
            process.exitCode = 1;
          });
          resolve(run().then(release));
        }
      });
    });
  };

  const runEventuallyWithNetwork = (mutexPort: ?string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const connectionOptions = {
        port: +mutexPort || constants.SINGLE_INSTANCE_PORT,
        host: 'localhost',
      };

      function startServer() {
        const clients = new Set();
        const server = http.createServer(manager);

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
          onDeath(killSockets);

          // Also kill the sockets if we finish, whether it's a success or a failure
          run().then(
            res => {
              killSockets();
              resolve(res);
            },
            err => {
              killSockets();
              reject(err);
            },
          );
        });

        function manager(request, response) {
          response.writeHead(200);
          response.end(JSON.stringify({cwd: config.cwd, pid: process.pid}));
        }

        function killSockets() {
          try {
            server.close();
          } catch (err) {
            // best effort
          }

          for (const socket of clients) {
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
              for (const handle of process._getActiveHandles()) {
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
        const request = http.get(connectionOptions, response => {
          const buffers = [];

          response.on('data', buffer => {
            buffers.push(buffer);
          });

          response.on('end', () => {
            try {
              const {cwd, pid} = JSON.parse(Buffer.concat(buffers).toString());
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
        const socket = net.createConnection(connectionOptions);

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

  function onUnexpectedError(err: Error) {
    function indent(str: string): string {
      return '\n  ' + str.trim().split('\n').join('\n  ');
    }

    const log = [];
    log.push(`Arguments: ${indent(process.argv.join(' '))}`);
    log.push(`PATH: ${indent(process.env.PATH || 'undefined')}`);
    log.push(`Yarn version: ${indent(version)}`);
    log.push(`Node version: ${indent(process.versions.node)}`);
    log.push(`Platform: ${indent(process.platform + ' ' + process.arch)}`);

    log.push(`Trace: ${indent(err.stack)}`);

    // add manifests
    for (const registryName of registryNames) {
      const possibleLoc = path.join(config.cwd, registries[registryName].filename);
      const manifest = fs.existsSync(possibleLoc) ? fs.readFileSync(possibleLoc, 'utf8') : 'No manifest';
      log.push(`${registryName} manifest: ${indent(manifest)}`);
    }

    // lockfile
    const lockLoc = path.join(
      config.lockfileFolder || config.cwd, // lockfileFolder might not be set at this point
      constants.LOCKFILE_FILENAME,
    );
    const lockfile = fs.existsSync(lockLoc) ? fs.readFileSync(lockLoc, 'utf8') : 'No lockfile';
    log.push(`Lockfile: ${indent(lockfile)}`);

    const errorReportLoc = writeErrorReport(log);

    reporter.error(reporter.lang('unexpectedError', err.message));

    if (errorReportLoc) {
      reporter.info(reporter.lang('bugReport', errorReportLoc));
    }
  }

  function writeErrorReport(log): ?string {
    const errorReportLoc = config.enableMetaFolder
      ? path.join(config.cwd, constants.META_FOLDER, 'yarn-error.log')
      : path.join(config.cwd, 'yarn-error.log');

    try {
      fs.writeFileSync(errorReportLoc, log.join('\n\n') + '\n');
    } catch (err) {
      reporter.error(reporter.lang('fileWriteError', errorReportLoc, err.message));
      return undefined;
    }

    return errorReportLoc;
  }

  const cwd = command.shouldRunInCurrentCwd ? commander.cwd : findProjectRoot(commander.cwd);

  await config
    .init({
      cwd,
      commandName,

      enablePnp: commander.pnp,
      disablePnp: commander.disablePnp,
      enableDefaultRc: commander.defaultRc,
      extraneousYarnrcFiles: commander.useYarnrc,
      binLinks: commander.binLinks,
      modulesFolder: commander.modulesFolder,
      linkFolder: commander.linkFolder,
      globalFolder: commander.globalFolder,
      preferredCacheFolder: commander.preferredCacheFolder,
      cacheFolder: commander.cacheFolder,
      preferOffline: commander.preferOffline,
      captureHar: commander.har,
      ignorePlatform: commander.ignorePlatform,
      ignoreEngines: commander.ignoreEngines,
      ignoreScripts: commander.ignoreScripts,
      offline: commander.preferOffline || commander.offline,
      looseSemver: !commander.strictSemver,
      production: commander.production,
      httpProxy: commander.proxy,
      httpsProxy: commander.httpsProxy,
      registry: commander.registry,
      networkConcurrency: commander.networkConcurrency,
      networkTimeout: commander.networkTimeout,
      nonInteractive: commander.nonInteractive,
      updateChecksums: commander.updateChecksums,
      focus: commander.focus,
      otp: commander.otp,
    })
    .then(() => {
      // lockfile check must happen after config.init sets lockfileFolder
      if (command.requireLockfile && !fs.existsSync(path.join(config.lockfileFolder, constants.LOCKFILE_FILENAME))) {
        throw new MessageError(reporter.lang('noRequiredLockfile'));
      }

      // option "no-progress" stored in yarn config
      const noProgressConfig = config.registries.yarn.getOption('no-progress');

      if (noProgressConfig) {
        reporter.disableProgress();
      }

      // verbose logs outputs process.uptime() with this line we can sync uptime to absolute time on the computer
      reporter.verbose(`current time: ${new Date().toISOString()}`);

      const mutex: mixed = commander.mutex;
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
          throw new MessageError(`Unknown single instance type ${mutexType}`);
        }
      } else {
        return run().then(exit);
      }
    })
    .catch((err: Error) => {
      reporter.verbose(err.stack);

      if (err instanceof MessageError) {
        reporter.error(err.message);
      } else {
        onUnexpectedError(err);
      }

      if (command.getDocsInfo) {
        reporter.info(command.getDocsInfo);
      }

      return exit(1);
    });
}

async function start(): Promise<void> {
  const rc = getRcConfigForCwd(process.cwd(), process.argv.slice(2));
  const yarnPath = rc['yarn-path'];

  if (yarnPath && !boolifyWithDefault(process.env.YARN_IGNORE_PATH, false)) {
    const argv = process.argv.slice(2);
    const opts = {stdio: 'inherit', env: Object.assign({}, process.env, {YARN_IGNORE_PATH: 1})};
    let exitCode = 0;

    try {
      exitCode = await spawnp(yarnPath, argv, opts);
    } catch (firstError) {
      try {
        exitCode = await forkp(yarnPath, argv, opts);
      } catch (error) {
        throw firstError;
      }
    }

    process.exitCode = exitCode;
  } else {
    // ignore all arguments after a --
    const doubleDashIndex = process.argv.findIndex(element => element === '--');
    const startArgs = process.argv.slice(0, 2);
    const args = process.argv.slice(2, doubleDashIndex === -1 ? process.argv.length : doubleDashIndex);
    const endArgs = doubleDashIndex === -1 ? [] : process.argv.slice(doubleDashIndex);

    await main({startArgs, args, endArgs});
  }
}

// When this module is compiled via Webpack, its child
// count will be 0 since it is a single-file bundle.
export const autoRun = module.children.length === 0;

if (require.main === module) {
  start().catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

export default start;
