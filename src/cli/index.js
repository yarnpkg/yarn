/* @flow */

import {ConsoleReporter, JSONReporter} from '../reporters/index.js';
import {sortAlpha} from '../util/misc.js';
import * as commands from './commands/index.js';
import * as constants from '../constants.js';
import * as network from '../util/network.js';
import {MessageError} from '../errors.js';
import aliases from './aliases.js';
import Config from '../config.js';

const camelCase = require('camelcase');
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

// set global options
commander.version(pkg.version);
commander.usage('[command] [flags]');
commander.option('--offline');
commander.option('--prefer-offline');
commander.option('--strict-semver');
commander.option('--json', '');
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

// get command name
let commandName: string = args.shift() || '';
let command;

//
const hyphenate = (string) => string.replace(/[A-Z]/g, (match) => ('-' + match.charAt(0).toLowerCase()));
const getDocsLink = (name) => `https://yarnpkg.com/en/docs/cli/${name || ''}`;
const getDocsInfo = (name) => 'Visit ' + chalk.bold(getDocsLink(name)) + ' for documentation about this command.';

//
if (commandName === 'help' || commandName === '--help' || commandName === '-h') {
  commandName = 'help';
  if (args.length) {
    const helpCommand = hyphenate(args[0]);
    if (commands[helpCommand]) {
      commander.on('--help', () => console.log('  ' + getDocsInfo(helpCommand) + '\n'));
    }
  } else {
    commander.on('--help', () => {
      console.log('  Commands:\n');
      for (const name of Object.keys(commands).sort(sortAlpha)) {
        if (commands[name].useless) {
          continue;
        }

        console.log(`    - ${hyphenate(name)}`);
      }
      console.log('\n  Run `' + chalk.bold('yarn help COMMAND') + '` for more information on specific commands.');
      console.log('  Visit ' + chalk.bold(getDocsLink()) + ' to learn more about Yarn.\n');
    });
  }
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

if (commandName === 'help' || args.indexOf('--help') >= 0 || args.indexOf('-h') >= 0) {
  const examples = (command && command.examples) || [];
  if (examples.length) {
    commander.on('--help', () => {
      console.log('  Examples:\n');
      for (const example of examples) {
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
invariant(command, 'missing command');

// parse flags
commander.parse(startArgs.concat(args));
commander.args = commander.args.concat(endArgs);

//
let Reporter = ConsoleReporter;
if (commander.json) {
  Reporter = JSONReporter;
}
const reporter = new Reporter({
  emoji: process.stdout.isTTY && process.platform === 'darwin',
});
reporter.initPeakMemoryCounter();

//
const config = new Config(reporter);

// print header
let outputWrapper = true;
if (typeof command.hasWrapper === 'function') {
  outputWrapper = command.hasWrapper(commander, commander.args);
}
if (outputWrapper) {
  reporter.header(commandName, {
    name: 'yarn',
    version: pkg.version,
  });
}

if (command.noArguments && args.length) {
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
      const socket = net.createConnection(connectionOptions);

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
  cacheFolder: commander.cacheFolder,
  preferOffline: commander.preferOffline,
  captureHar: commander.har,
  ignorePlatform: commander.ignorePlatform,
  ignoreEngines: commander.ignoreEngines,
  offline: commander.preferOffline || commander.offline,
  looseSemver: !commander.strictSemver,
}).then((): Promise<void> => {
  const exit = () => {
    process.exit(0);
  };

  const mutex = commander.mutex;
  if (mutex && typeof mutex === 'string') {
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
}).catch((errs) => {
  function logError(err) {
    if (err instanceof MessageError) {
      reporter.error(err.message);
    } else {
      reporter.error(err.stack.replace(/^Error: /, ''));
    }
  }

  if (errs) {
    if (Array.isArray(errs)) {
      for (const err of errs) {
        logError(err);
      }
    } else {
      logError(errs);
    }

    const actualCommandForHelp = commands[commandName] ? commandName : aliases[commandName];
    if (actualCommandForHelp) {
      reporter.info(getDocsInfo(actualCommandForHelp));
    }
  }

  process.exit(1);
});
