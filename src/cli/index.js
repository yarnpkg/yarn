/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import buildExecuteLifecycleScript from './commands/_execute-lifecycle-script.js';
import {ConsoleReporter, JSONReporter} from '../reporters/index.js';
import * as commands from './commands/index.js';
import * as constants from '../constants.js';
import * as network from '../util/network.js';

import aliases from './aliases.js';
import Config from '../config.js';
import onDeath from 'death';

const net = require('net');
const path = require('path');
const fs = require('fs');

let loudRejection = require('loud-rejection');
let commander = require('commander');
let invariant = require('invariant');
let pkg = require('../../package');
let _ = require('lodash');

loudRejection();

let args = process.argv;

// set global options
commander.version(pkg.version);
commander.usage('[command] [flags]');
commander.option('--offline');
commander.option('--prefer-offline');
commander.option('--json', '');
commander.option('--modules-folder [path]', 'rather than installing modules into the node_modules ' +
                                            'folder relative to the cwd, output them here');
commander.option('--packages-root [path]', 'rather than storing modules into a global packages root,' +
                                           'store them here');
commander.option(
 '--force-single-instance',
 'pause and wait if other instances are running on the same folder',
);
commander.option(
  '--port [port]',
  `use with --force-single-instance to ovveride the default port (${constants.DEFAULT_PORT_FOR_SINGLE_INSTANCE})`,
);

// get command name
let commandName = args.splice(2, 1)[0] || '';

// if command name looks like a flag or doesn't exist then print help
if (commandName[0] === '-') {
  args.splice(2, 0, commandName);
  commandName = null;
}

// handle aliases: i -> install
if (commandName && _.has(aliases, commandName)) {
  commandName = aliases[commandName];
}

//
if (!commandName) {
  commander.parse(args);
  commander.help();
  process.exit(1);
}

//
invariant(commandName, 'Missing command name');
let command = commands[_.camelCase(commandName)];

if (!command) {
  command = buildExecuteLifecycleScript(commandName);
}

// parse flags
if (command.setFlags) {
  command.setFlags(commander);
}
commander.parse(args);

//
let Reporter = ConsoleReporter;
if (commander.json) {
  Reporter = JSONReporter;
}
let reporter = new Reporter({
  emoji: true,
});
reporter.initPeakMemoryCounter();

//
let config = new Config(reporter, {
  modulesFolder: commander.modulesFolder,
  packagesRoot: commander.packagesRoot,
  preferOffline: commander.preferOffline,
  offline: commander.preferOffline || commander.offline,
});

// print header
let outputWrapper = true;
if (command.hasWrapper) {
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
  reporter.error('No lockfile in this directory. Run `kpm install` to generate one.');
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
      // another kpm instance exists, let's connect to it to know when it dies.
      reporter.warn('waiting until the other kpm instance finish.');
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
  if (commander.forceSingleInstance) {
    return runEventually().then(() => {
      process.exit(0);
    });
  } else {
    return run().then(() => {
      process.exit(0);
    });
  }
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
