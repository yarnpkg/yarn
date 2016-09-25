/* @flow */

import {ConsoleReporter, JSONReporter} from '../reporters/index.js';
import {sortAlpha} from '../util/misc.js';
import * as commands from './commands/index.js';
import * as constants from '../constants.js';
import * as network from '../util/network.js';

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
const args = process.argv.slice(2);

// set global options
commander.version(pkg.version);
commander.usage('[command] [flags]');
commander.option('--offline');
commander.option('--prefer-offline');
commander.option('--strict-semver');
commander.option('--json', '');
commander.option('--global-folder [path]', '');
commander.option('--modules-folder [path]', 'rather than installing modules into the node_modules ' +
                                            'folder relative to the cwd, output them here');
commander.option('--packages-root [path]', 'rather than storing modules into a global packages root,' +
                                           'store them here');
commander.option(
 '--force-single-instance',
 'pause and wait if other instances are running on the same folder using a tcp server',
);
commander.option(
  '--port [port]',
  `use with --force-single-instance to ovveride the default port (${constants.DEFAULT_PORT_FOR_SINGLE_INSTANCE})`,
);
commander.option(
  '--force-single-instance-with-file',
  'pause and wait if other instances are running on the same folder using a operating system lock file',
);

// get command name
let commandName: string = args.shift() || '';

//
if (commandName === 'help' && !args.length) {
  commander.on('--help', function() {
    console.log('  Commands:');
    console.log();
    for (let name of Object.keys(commands).sort(sortAlpha)) {
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
if (commandName && commandName !== 'install' && typeof aliases[commandName] === 'string') {
  commandName = aliases[commandName];
}

//
if (commandName === 'help' && args.length) {
  commandName = camelCase(args.shift());
  args.push('--help');
}

//
invariant(commandName, 'Missing command name');
let command = commands[camelCase(commandName)];

//
if (command && typeof command.setFlags === 'function') {
  command.setFlags(commander);
}

//
if (commandName === 'help' || args.indexOf('--help') >= 0 || args.indexOf('-h') >= 0) {
  const examples = command && command.examples;
  if (Array.isArray(examples) && examples.length) {
    commander.on('--help', function() {
      console.log('  Examples:');
      console.log();
      for (let example of examples) {
        console.log(`    $ yarn ${example}`);
      }
      console.log();
    });
  }

  commander.parse(startArgs.concat(args));
  commander.help();
  process.exit(1);
}

//
if (!command) {
  args.unshift(commandName);
  command = commands.run;
}

// parse flags
commander.parse(startArgs.concat(args));

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
let config = new Config(reporter, {
  modulesFolder: commander.modulesFolder,
  globalFolder: commander.globalFolder,
  packagesRoot: commander.packagesRoot,
  preferOffline: commander.preferOffline,
  captureHar: commander.har,
  ignoreEngines: commander.ignoreEngines,
  offline: commander.preferOffline || commander.offline,
  looseSemver: !commander.strictSemver,
});

// print header
let outputWrapper = true;
if (typeof command.hasWrapper === 'function') {
  outputWrapper = command.hasWrapper(commander, commander.args);
}
if (outputWrapper) {
  reporter.header(commandName, pkg);
}

//
if (commander.yes) {
  reporter.warn(
    'The yes flag has been set. This will automatically answer yes to all questions which ' +
    'may have security implications.',
  );
}

//
if (!commander.offline && network.isOffline()) {
  reporter.warn(
    "You don't appear to have an internet connection. " +
    'Try the --offline flag to use the cache for registry queries.',
  );
}

//
if (command.requireLockfile && !fs.existsSync(path.join(config.cwd, constants.LOCKFILE_FILENAME))) {
  reporter.error(reporter.lang('noRequiredLockfile'));
  process.exit(1);
}

//
const run = (): Promise<void> => {
  return command.run(config, reporter, commander, commander.args).then(function() {
    reporter.close();
    if (outputWrapper) {
      reporter.footer(false);
    }
  });
};

//
const runEventuallyWithLockFile = (isFirstTime): Promise<void> => {
  return new Promise((ok) => {
    const lock = path.join(config.cwd, constants.SINGLE_INSTANCE_FILENAME);
    lockfile.lock(lock, {realpath: false}, (err, release) => {
      if (err) {
        if (isFirstTime) {
          reporter.warn(reporter.lang('waitingInstance'));
        }
        setTimeout(() => {
          ok(runEventuallyWithLockFile());
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
const runEventually = (): Promise<void> => {
  return new Promise((ok) => {
    const connectionOptions = {
      port: commander.port || constants.DEFAULT_PORT_FOR_SINGLE_INSTANCE,
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
            ok(runEventually());
          });
        })
        .on('error', (e) => {
          // No server to listen to ? :O let's retry to become the next server then.
          process.nextTick(() => {
            ok(runEventually());
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
config.init().then(function(): Promise<void> {
  const exit = () => {
    process.exit(0);
  };

  if (commander.forceSingleInstanceWithFile) {
    return runEventuallyWithLockFile(true).then(exit);
  }

  if (commander.forceSingleInstance) {
    return runEventually().then(exit);
  }

  return run().then(exit);
}).catch(function(errs) {
  function logError(err) {
    reporter.error(err.stack.replace(/^Error: /, ''));
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
