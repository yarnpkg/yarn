/* @flow */

import {ConsoleReporter, JSONReporter} from '../reporters/index.js';
import {sortAlpha} from '../util/misc.js';
import * as commands from './commands/index.js';
import * as constants from '../constants.js';
import * as network from '../util/network.js';
import {MessageError} from '../errors.js';
import aliases from './aliases.js';
import Config from '../config.js';

const loudRejection = require('loud-rejection');
const camelCase = require('camelcase');
const commander = require('commander');
const invariant = require('invariant');
const lockfile = require('proper-lockfile');
const onDeath = require('death');
const path = require('path');
const net = require('net');
const fs = require('fs');

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

// set global options
commander.version(pkg.version);
commander.usage('[command] [flags]');
commander.option('--offline');
commander.option('--prefer-offline');
commander.option('--strict-semver');
commander.option('--json', '');
commander.option('--global-folder [path]', '');
commander.option(
  '--modules-folder [path]',
  'rather than installing modules into the node_modules folder relative to the cwd, output them here',
);
commander.option(
  '--packages-root [path]',
  'rather than storing modules into a global packages root, store them here',
);
commander.option(
  '--mutex [type][:specifier]',
  'use a mutex to ensure only one yarn instance is executing',
);
commander.allowUnknownOption();

// get command name
let commandName: string = args.shift() || '';
let command;

//
if (commandName === 'help' && !args.length) {
  commander.on('--help', function() {
    console.log('  Commands:');
    console.log();
    for (let name of Object.keys(commands).sort(sortAlpha)) {
      if (commands[name].useless) {
        continue;
      }

      console.log(`    * ${name}`);
    }
    console.log();
    console.log('  Run `yarn help COMMAND` for more information on specific commands.');
    console.log();
  });
}

// if no args or command name looks like a flag then default to `install`
if (!commandName || commandName[0] === '-') {
  if (commandName) {
    args.unshift(commandName);
  }
  commandName = 'install';
}

// aliases: i -> install
// $FlowFixMe
if (commandName && typeof aliases[commandName] === 'string') {
  command = {
    run(config: Config, reporter: ConsoleReporter | JSONReporter): Promise<void> {
      throw new MessageError(`Did you mean \`yarn ${aliases[commandName]}\`?`);
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
command = command || commands[camelCase(commandName)];

//
if (command && typeof command.setFlags === 'function') {
  command.setFlags(commander);
}

//
const DEFAULT_EXAMPLES = [
  '--mutex file',
  '--mutex file:my-custom-filename',
  '--mutex network',
  '--mutex network:8008',
];

//
if (commandName === 'help' || args.indexOf('--help') >= 0 || args.indexOf('-h') >= 0) {
  const examples = DEFAULT_EXAMPLES.concat((command && command.examples) || []);
  commander.on('--help', function() {
    console.log('  Examples:');
    console.log();
    for (let example of examples) {
      console.log(`    $ yarn ${example}`);
    }
    console.log();
  });

  commander.parse(startArgs.concat(args));
  commander.help();
  process.exit(1);
}

//
if (!command) {
  args.unshift(commandName);
  command = commands.run;
}
invariant(command, 'missing command');

// parse flags
commander.parse(startArgs.concat(args));
commander.args = commander.args.concat(endArgs);

//
let Reporter = ConsoleReporter;
if (commander.json) {
  Reporter = JSONReporter;
}
let reporter = new Reporter({
  emoji: process.stdout.isTTY && process.platform === 'darwin',
});
reporter.initPeakMemoryCounter();

//
let config = new Config(reporter);

// print header
let outputWrapper = true;
if (typeof command.hasWrapper === 'function') {
  outputWrapper = command.hasWrapper(commander, commander.args);
}
if (outputWrapper) {
  reporter.header(commandName, pkg);
}

if (command.noArguments && args.length) {
  reporter.error(reporter.lang('noArguments'));
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
  return command.run(config, reporter, commander, commander.args).then(function() {
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
    lockfile.lock(lockFilename, {realpath: false}, (err, release) => {
      if (err) {
        if (isFirstTime) {
          reporter.warn(reporter.lang('waitingInstance'));
        }
        setTimeout(() => {
          ok(runEventuallyWithFile());
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

    const clients = [];
    const server = net.createServer((client) => {
      clients.push(client);
    });

    server.on('error', () => {
      // another yarnn instance exists, let's connect to it to know when it dies.
      reporter.warn(reporter.lang('waitingInstance'));
      let socket = net.createConnection(connectionOptions);

      socket
        .on('data', () => {
          // the server has informed us he's going to die soon™.
          socket.unref(); // let it die
          process.nextTick(() => {
            ok(runEventuallyWithNetwork());
          });
        })
        .on('error', (e) => {
          // No server to listen to ? :O let's retry to become the next server then.
          process.nextTick(() => {
            ok(runEventuallyWithNetwork());
          });
        });
    });

    const onServerEnd = (): Promise<void> => {
      clients.forEach((client) => {
        client.write('closing. kthanx, bye.');
      });
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

//
config.init({
  modulesFolder: commander.modulesFolder,
  globalFolder: commander.globalFolder,
  packagesRoot: commander.packagesRoot,
  preferOffline: commander.preferOffline,
  captureHar: commander.har,
  ignoreEngines: commander.ignoreEngines,
  offline: commander.preferOffline || commander.offline,
  looseSemver: !commander.strictSemver,
}).then(function(): Promise<void> {
  const exit = () => {
    process.exit(0);
  };

  const mutex = commander.mutex;
  if (mutex) {
    const parts = mutex.split(':');
    const mutexType = parts.shift();
    const mutexSpecifier = parts.join(':');

    if (mutexType === 'file') {
      return runEventuallyWithFile(mutexSpecifier, true).then(exit);
    } else if (mutexType === 'network') {
      return runEventuallyWithNetwork(mutexSpecifier).then(exit);
    } else {
      throw new Error(`Unknown single instance type ${mutexType}`);
    }
  } else {
    return run().then(exit);
  }
}).catch(function(errs) {
  function logError(err) {
    if (err instanceof MessageError) {
      reporter.error(err.message);
    } else {
      reporter.error(err.stack.replace(/^Error: /, ''));
    }
  }

  if (errs) {
    if (Array.isArray(errs)) {
      for (let err of errs) {
        logError(err);
      }
    } else {
      logError(errs);
    }
  }

  process.exit(1);
});
