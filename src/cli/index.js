/* @flow */

import {ConsoleReporter, JSONReporter} from '../reporters/index.js';
import {registries, registryNames} from '../registries/index.js';
import * as commands from './commands/index.js';
import * as constants from '../constants.js';
import * as network from '../util/network.js';
import {MessageError} from '../errors.js';
import aliases from './aliases.js';
import Config from '../config.js';
import {camelCase} from '../util/misc.js';

const chalk = require('chalk');
const commander = require('commander');
const fs = require('fs');
const invariant = require('invariant');
const lockfile = require('proper-lockfile');
const loudRejection = require('loud-rejection');
const net = require('net');
const onDeath = require('death');
const path = require('path');
const pkg = require('../../package.json');

loudRejection();

//
const startArgs = process.argv.slice(0, 2);
let args = process.argv.slice(2);

// ignore all arguments after a --
let endArgs = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--') {
    endArgs = args.slice(i + 1);
    args = args.slice(0, i);
  }
}

// NOTE: Pending resolution of https://github.com/tj/commander.js/issues/346
// Remove this (and subsequent use in the logic below) after bug is resolved and issue is closed
const ARGS_THAT_SHARE_NAMES_WITH_OPTIONS = [
  'version',
];

// set global options
commander.version(pkg.version);
commander.usage('[command] [flags]');
commander.option('--verbose', 'output verbose messages on internal operations');
commander.option('--offline', 'trigger an error if any required dependencies are not available in local cache');
commander.option('--prefer-offline', 'use network only if dependencies are not available in local cache');
commander.option('--strict-semver');
commander.option('--json', '');
commander.option('--ignore-scripts', "don't run lifecycle scripts");
commander.option('--har', 'save HAR output of network traffic');
commander.option('--ignore-platform', 'ignore platform checks');
commander.option('--ignore-engines', 'ignore engines check');
commander.option('--ignore-optional', 'ignore optional dependencies');
commander.option('--force', 'install and build scripts even if they were built before, overwrite lockfile');
commander.option('--skip-integrity-check', 'run install without checking if node_modules is installed');
commander.option('--no-bin-links', "don't generate bin links when setting up packages");
commander.option('--flat', 'only allow one version of a package');
commander.option('--prod, --production [prod]', '');
commander.option('--no-lockfile', "don't read or generate a lockfile");
commander.option('--pure-lockfile', "don't generate a lockfile");
commander.option('--frozen-lockfile', "don't generate a lockfile and fail if an update is needed");
commander.option('--link-duplicates', 'create hardlinks to the repeated modules in node_modules');
commander.option('--global-folder <path>', '');
commander.option(
  '--modules-folder <path>',
  'rather than installing modules into the node_modules folder relative to the cwd, output them here',
);
commander.option(
  '--cache-folder <path>',
  'specify a custom folder to store the yarn cache',
);
commander.option(
  '--mutex <type>[:specifier]',
  'use a mutex to ensure only one yarn instance is executing',
);
commander.option(
  '--no-emoji',
  'disable emoji in output',
);
commander.option('--proxy <host>', '');
commander.option('--https-proxy <host>', '');
commander.option(
  '--no-progress',
  'disable progress bar',
);
commander.option('--network-concurrency <number>', 'maximum number of concurrent network requests', parseInt);

// get command name
let commandName: ?string = args.shift() || '';
let command;

//
const getDocsLink = (name) => `${constants.YARN_DOCS}${name || ''}`;
const getDocsInfo = (name) => 'Visit ' + chalk.bold(getDocsLink(name)) + ' for documentation about this command.';

//
if (commandName === '--help' || commandName === '-h') {
  commandName = 'help';
}

// if no args or command name looks like a flag then default to `install`
if (!commandName || commandName[0] === '-') {
  if (commandName) {
    args.unshift(commandName);
  }
  commandName = 'install';
}

// aliases: i -> install
if (commandName && typeof aliases[commandName] === 'string') {
  const alias = aliases[commandName];
  command = {
    run(config: Config, reporter: ConsoleReporter | JSONReporter): Promise<void> {
      throw new MessageError(`Did you mean \`yarn ${alias}\`?`);
    },
  };
}

//
if (commandName === 'help' && args.length) {
  commandName = camelCase(args.shift());
  args.push('--help');
}

//
invariant(commandName, 'Missing command name');
if (!command) {
  const camelised = camelCase(commandName);
  if (camelised) {
    command = commands[camelised];
  }
}

//
if (command && typeof command.setFlags === 'function') {
  command.setFlags(commander);
}

if (args.indexOf('--help') >= 0 || args.indexOf('-h') >= 0) {
  const examples: Array<string> = (command && command.examples) || [];
  if (examples.length) {
    commander.on('--help', () => {
      console.log('  Examples:\n');
      for (const example of examples) {
        console.log(`    $ yarn ${example}`);
      }
      console.log();
    });
  }
  commander.on('--help', () => console.log('  ' + getDocsInfo(commandName) + '\n'));

  commander.parse(startArgs.concat(args));
  commander.help();
  process.exit(1);
}

// parse flags
args.unshift(commandName);

if (ARGS_THAT_SHARE_NAMES_WITH_OPTIONS.indexOf(commandName) >= 0 && args[0] === commandName) {
  args.shift();
}

commander.parse(startArgs.concat(args));
commander.args = commander.args.concat(endArgs);

if (command) {
  commander.args.shift();
} else {
  command = commands.run;
}
invariant(command, 'missing command');

//
let Reporter = ConsoleReporter;
if (commander.json) {
  Reporter = JSONReporter;
}
const reporter = new Reporter({
  emoji: commander.emoji && process.stdout.isTTY && process.platform === 'darwin',
  verbose: commander.verbose,
  noProgress: !commander.progress,
});
reporter.initPeakMemoryCounter();

//
const config = new Config(reporter);

// print header
let outputWrapper = true;
if (typeof command.hasWrapper === 'function') {
  outputWrapper = command.hasWrapper(commander, commander.args);
}
if (commander.json) {
  outputWrapper = false;
}
if (outputWrapper && commandName !== 'help') {
  reporter.header(commandName, pkg);
}

if (command.noArguments && commander.args.length) {
  reporter.error(reporter.lang('noArguments'));
  reporter.info(getDocsInfo(commandName));
  process.exit(1);
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
  process.exit(1);
}

//
const run = (): Promise<void> => {
  invariant(command, 'missing command');
  return command.run(config, reporter, commander, commander.args).then(() => {
    reporter.close();
    if (outputWrapper) {
      reporter.footer(false);
    }
  });
};

//
const runEventuallyWithFile = (mutexFilename: ?string, isFirstTime?: boolean): Promise<void> => {
  return new Promise((ok) => {
    const lockFilename = mutexFilename || path.join(config.cwd, constants.SINGLE_INSTANCE_FILENAME);
    lockfile.lock(lockFilename, {realpath: false}, (err: mixed, release: () => void) => {
      if (err) {
        if (isFirstTime) {
          reporter.warn(reporter.lang('waitingInstance'));
        }
        setTimeout(() => {
          ok(runEventuallyWithFile(mutexFilename, isFirstTime));
        }, 200); // do not starve the CPU
      } else {
        onDeath(() => {
          process.exit(1);
        });
        ok(run().then(release));
      }
    });
  });
};

//
const runEventuallyWithNetwork = (mutexPort: ?string): Promise<void> => {
  return new Promise((ok) => {
    const connectionOptions = {
      port: +mutexPort || constants.SINGLE_INSTANCE_PORT,
    };

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
              ok(runEventuallyWithNetwork(mutexPort));
            });
          }
        })
        .on('error', () => {
          // No server to listen to ? Let's retry to become the next server then.
          process.nextTick(() => {
            ok(runEventuallyWithNetwork(mutexPort));
          });
        });
    });

    const onServerEnd = (): Promise<void> => {
      server.close();
      return Promise.resolve();
    };

    // open the server and continue only if succeed.
    server.listen(connectionOptions, () => {
      // ensure the server gets closed properly on SIGNALS.
      onDeath(onServerEnd);

      ok(run().then(onServerEnd));
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
  log.push(`Yarn version: ${indent(pkg.version)}`);
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

function writeErrorReport(log) : ?string {
  const errorReportLoc = path.join(config.cwd, 'yarn-error.log');

  try {
    fs.writeFileSync(errorReportLoc, log.join('\n\n') + '\n');
  } catch (err) {
    reporter.error(reporter.lang('fileWriteError', errorReportLoc, err.message));
    return undefined;
  }

  return errorReportLoc;
}

//
config.init({
  binLinks: commander.binLinks,
  modulesFolder: commander.modulesFolder,
  globalFolder: commander.globalFolder,
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
  commandName,
}).then(() => {

  // option "no-progress" stored in yarn config
  const noProgressConfig = config.registries.yarn.getOption('no-progress');

  if (noProgressConfig) {
    reporter.disableProgress();
  }

  const exit = () => {
    process.exit(0);
  };
  // verbose logs outputs process.uptime() with this line we can sync uptime to absolute time on the computer
  reporter.verbose(`current time: ${new Date().toISOString()}`);

  const mutex: mixed = commander.mutex;
  if (mutex && typeof mutex === 'string') {
    const parts = mutex.split(':');
    const mutexType = parts.shift();
    const mutexSpecifier = parts.join(':');

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
}).catch((err: Error) => {
  reporter.verbose(err.stack);

  if (err instanceof MessageError) {
    reporter.error(err.message);
  } else {
    onUnexpectedError(err);
  }

  if (commandName) {
    const actualCommandForHelp = commands[commandName] ? commandName : aliases[commandName];
    if (command && actualCommandForHelp) {
      reporter.info(getDocsInfo(actualCommandForHelp));
    }
  }

  process.exit(1);
});
