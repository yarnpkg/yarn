/* @flow */

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

const commander = require('commander');
const fs = require('fs');
const invariant = require('invariant');
const lockfile = require('proper-lockfile');
const loudRejection = require('loud-rejection');
const net = require('net');
const onDeath = require('death');
const path = require('path');

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

export function main({
  startArgs,
  args,
  endArgs,
}: {
  startArgs: Array<string>,
  args: Array<string>,
  endArgs: Array<string>,
}) {
  loudRejection();
  handleSignals();

  // set global options
  commander.version(version, '--version');
  commander.usage('[command] [flags]');
  commander.option('-v, --verbose', 'output verbose messages on internal operations');
  commander.option('--offline', 'trigger an error if any required dependencies are not available in local cache');
  commander.option('--prefer-offline', 'use network only if dependencies are not available in local cache');
  commander.option('--strict-semver');
  commander.option('--json', '');
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
  commander.option('--prod, --production [prod]', '');
  commander.option('--no-lockfile', "don't read or generate a lockfile");
  commander.option('--pure-lockfile', "don't generate a lockfile");
  commander.option('--frozen-lockfile', "don't generate a lockfile and fail if an update is needed");
  commander.option('--link-duplicates', 'create hardlinks to the repeated modules in node_modules');
  commander.option('--global-folder <path>', 'specify a custom folder to store global packages');
  commander.option(
    '--modules-folder <path>',
    'rather than installing modules into the node_modules folder relative to the cwd, output them here',
  );
  commander.option('--preferred-cache-folder <path>', 'specify a custom folder to store the yarn cache if possible');
  commander.option('--cache-folder <path>', 'specify a custom folder that must be used to store the yarn cache');
  commander.option('--mutex <type>[:specifier]', 'use a mutex to ensure only one yarn instance is executing');
  commander.option('--emoji [bool]', 'enable emoji in output', process.platform === 'darwin');
  commander.option('-s, --silent', 'skip Yarn console logs, other types of logs (script output) will be printed');
  commander.option('--cwd <cwd>', 'working directory to use', process.cwd());
  commander.option('--proxy <host>', '');
  commander.option('--https-proxy <host>', '');
  commander.option('--no-progress', 'disable progress bar');
  commander.option('--network-concurrency <number>', 'maximum number of concurrent network requests', parseInt);
  commander.option('--network-timeout <milliseconds>', 'TCP timeout for network requests', parseInt);
  commander.option('--non-interactive', 'do not show interactive prompts');
  commander.option('--scripts-prepend-node-path [bool]', 'prepend the node executable dir to the PATH in scripts');

  // get command name
  let commandName: string = args.shift() || 'install';

  // if -v is the first command, then always exit after returning the version
  if (commandName === '-v') {
    console.log(version.trim());
    process.exitCode = 0;
    return;
  }

  if (commandName === '--help' || commandName === '-h') {
    commandName = 'help';
  }

  if (args.indexOf('--help') >= 0 || args.indexOf('-h') >= 0) {
    args.unshift(commandName);
    commandName = 'help';
  }

  // if no args or command name looks like a flag then set default to `install`
  if (commandName[0] === '-') {
    args.unshift(commandName);
    commandName = 'install';
  }

  let command;
  if (Object.prototype.hasOwnProperty.call(commands, commandName)) {
    command = commands[commandName];
  }

  // if command is not recognized, then set default to `run`
  if (!command) {
    args.unshift(commandName);
    command = commands.run;
  }

  let warnAboutRunDashDash = false;
  // we are using "yarn <script> -abc" or "yarn run <script> -abc", we want -abc to be script options, not yarn options
  if (command === commands.run) {
    if (endArgs.length === 0) {
      endArgs = ['--', ...args.splice(1)];
    } else {
      warnAboutRunDashDash = true;
    }
  }

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
    isSilent: process.env.YARN_SILENT === '1' || commander.silent,
  });

  reporter.initPeakMemoryCounter();

  const config = new Config(reporter);
  const outputWrapper = !commander.json && command.hasWrapper(commander, commander.args);

  if (outputWrapper) {
    reporter.header(commandName, {name: 'yarn', version});
  }

  if (command.noArguments && commander.args.length) {
    reporter.error(reporter.lang('noArguments'));
    reporter.info(command.getDocsInfo);
    process.exitCode = 1;
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
  if (command.requireLockfile && !fs.existsSync(path.join(config.cwd, constants.LOCKFILE_FILENAME))) {
    reporter.error(reporter.lang('noRequiredLockfile'));
    process.exitCode = 1;
    return;
  }

  //
  const run = (): Promise<void> => {
    invariant(command, 'missing command');

    if (warnAboutRunDashDash) {
      reporter.warn(reporter.lang('dashDashDeprecation'));
    }

    return command.run(config, reporter, commander, commander.args).then(exitCode => {
      if (outputWrapper) {
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

  //
  const runEventuallyWithNetwork = (mutexPort: ?string): Promise<void> => {
    return new Promise(resolve => {
      const connectionOptions = {
        port: +mutexPort || constants.SINGLE_INSTANCE_PORT,
      };

      const clients = new Set();
      const server = net.createServer();

      server.on('error', () => {
        // another Yarn instance exists, let's connect to it to know when it dies.
        reporter.warn(reporter.lang('waitingInstance'));
        const socket = net.createConnection(connectionOptions);

        socket
          .on('connect', () => {
            // Allow the program to exit if this is the only active server in the event system.
            socket.unref();
          })
          .on('close', (hadError?: boolean) => {
            // the `close` event gets always called after the `error` event
            if (!hadError) {
              process.nextTick(() => {
                resolve(runEventuallyWithNetwork(mutexPort));
              });
            }
          })
          .on('error', () => {
            // No server to listen to ? Let's retry to become the next server then.
            process.nextTick(() => {
              resolve(runEventuallyWithNetwork(mutexPort));
            });
          });
      });

      const onServerEnd = async () => {
        for (const client of clients) {
          try {
            client.destroy();
          } catch (err) {
            // pass
          }
        }

        await server.close();
        server.unref();
      };

      // open the server and continue only if succeed.
      server.listen(connectionOptions, () => {
        // ensure the server gets closed properly on SIGNALS.
        onDeath(onServerEnd);

        resolve(run().then(onServerEnd));
      });

      server.on('connection', function(socket) {
        clients.add(socket);

        socket.on('close', () => clients.delete(socket));
      });
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

    // add manifests
    for (const registryName of registryNames) {
      const possibleLoc = path.join(config.cwd, registries[registryName].filename);
      const manifest = fs.existsSync(possibleLoc) ? fs.readFileSync(possibleLoc, 'utf8') : 'No manifest';
      log.push(`${registryName} manifest: ${indent(manifest)}`);
    }

    // lockfile
    const lockLoc = path.join(config.cwd, constants.LOCKFILE_FILENAME);
    const lockfile = fs.existsSync(lockLoc) ? fs.readFileSync(lockLoc, 'utf8') : 'No lockfile';
    log.push(`Lockfile: ${indent(lockfile)}`);

    log.push(`Trace: ${indent(err.stack)}`);

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

  const exit = exitCode => {
    process.exitCode = exitCode || 0;
    return reporter.close();
  };

  const cwd = findProjectRoot(commander.cwd);

  config
    .init({
      cwd,

      binLinks: commander.binLinks,
      modulesFolder: commander.modulesFolder,
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
      networkConcurrency: commander.networkConcurrency,
      networkTimeout: commander.networkTimeout,
      nonInteractive: commander.nonInteractive,
      scriptsPrependNodePath: commander.scriptsPrependNodePath,

      commandName: commandName === 'run' ? commander.args[0] : commandName,
    })
    .then(() => {
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

      if (commands[commandName]) {
        reporter.info(commands[commandName].getDocsInfo);
      }

      return exit(1);
    });
}

async function start(): Promise<void> {
  const rc = getRcConfigForCwd(process.cwd());
  const yarnPath = rc['yarn-path'];

  if (yarnPath && process.env.YARN_IGNORE_PATH !== '1') {
    const argv = process.argv.slice(2);
    const opts = {stdio: 'inherit', env: Object.assign({}, process.env, {YARN_IGNORE_PATH: 1})};

    try {
      await spawnp(yarnPath, argv, opts);
    } catch (firstError) {
      try {
        await forkp(yarnPath, argv, opts);
      } catch (error) {
        throw firstError;
      }
    }
  } else {
    // ignore all arguments after a --
    const doubleDashIndex = process.argv.findIndex(element => element === '--');
    const startArgs = process.argv.slice(0, 2);
    const args = process.argv.slice(2, doubleDashIndex === -1 ? process.argv.length : doubleDashIndex);
    const endArgs = doubleDashIndex === -1 ? [] : process.argv.slice(doubleDashIndex);

    main({startArgs, args, endArgs});
  }
}

// When this module is compiled via Webpack, its child
// count will be 0 since it is a single-file bundle.
export const autoRun = module.children.length === 0;

if (require.main === module) {
  start();
}

export default start;
