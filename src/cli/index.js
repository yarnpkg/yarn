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

const net             = require('net');
const path            = require('path');
const fs              = require('fs');

let loudRejection     = require('loud-rejection');
let commander         = require('commander');
let invariant         = require('invariant');
let pkg               = require('../../package');
let _                 = require('lodash');
let lastWillExpressed = false;

loudRejection();

let args = process.argv;

// set global options
commander.version(pkg.version);
commander.usage('[command] [flags]');
commander.option('--offline');
commander.option('--json', '');
commander.option('--modules-folder [path]', 'rather than installing modules into the node_modules ' +
                                            'folder relative to the cwd, output them here');
commander.option('--packages-root [path]', 'rather than storing modules into a global packages root,' +
                                           'store them here');
commander.option(
 '--force-single-instance',
 'pause and wait if other instances are running on the same folder',
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
  offline: commander.offline,
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
    const socketFile = path.join(config.cwd, constants.SINGLE_SOCKET_FILENAME);
    const clients = [];
    const unixServer = net.createServer((client) => {
      clients.push(client);
    });
    unixServer.on('error', () => {
      // another process exists, wait until it dies.
      reporter.warn('waiting until the other kpm instance finish.');

      let socket = net.createConnection(socketFile);

      socket.on('connect', () => {}).on('data', () => {
        socket.unref();
        setTimeout(() => {
          ok(runEventually().then(process.exit));
        }, 200);
      }).on('error', (e) => {
        ok(runEventually().then(process.exit));
      });
    });

    const clean = () => {
      // clean after ourself.
      clients.forEach((client) => {
        client.write('closing. kthanx, bye.');
      });
      unixServer.close();
      try {
        fs.unlinkSync(socketFile);
      } catch (e) {}
      process.exit();
    };

    if (!lastWillExpressed) {
      onDeath(clean);
      lastWillExpressed = true;
    }

    unixServer.listen(socketFile, () => {
      ok(run().then(clean));
    });
  });
};

//
config.init().then(function(): Promise<void> {
  if (commander.forceSingleInstance) {
    return runEventually();
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
