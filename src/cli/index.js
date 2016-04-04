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

import buildExecuteLifecycleScript from "./commands/_execute-lifecycle-script.js";
import { ConsoleReporter, JSONReporter } from "kreporters";
import { MessageError } from "../errors.js";
import * as network from "../util/network.js";
import * as commands from "./commands/index.js";
import aliases from "./aliases.js";
import Config from "../config.js";

let loudRejection = require("loud-rejection");
let commander     = require("commander");
let invariant     = require("invariant");
let pkg           = require("../../package");
let _             = require("lodash");

loudRejection();

let args = process.argv;

// set global options
commander.version(pkg.version);
commander.usage("[command] [flags]");
commander.option("--json", "");

// get command name
let commandName = args.splice(2, 1)[0] || "";

// if command name looks like a flag or doesn't exist then print help
if (commandName[0] === "-") {
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
invariant(commandName, "Missing command name");
let command = commands[_.camelCase(commandName)];

if (!command) {
  command = buildExecuteLifecycleScript(commandName);
}

// parse flags
if (command.setFlags) command.setFlags(commander);
commander.parse(args);

//
let Reporter = ConsoleReporter;
if (commander.json) Reporter = JSONReporter;
let reporter = new Reporter({
  emoji: true
});
reporter.initPeakMemoryCounter();

//
let config = new Config(reporter);

// print header
reporter.header(commandName, pkg);

//
if (commander.yes) {
  reporter.warn(
    "The yes flag has been set. This will automatically answer yes to all questions which " +
    "may have security implications."
  );
}

//
if (network.isOffline()) {
  reporter.warn("You don't appear to have an internet connection.");
}

//
config.init().then(function () {
  return command.run(config, reporter, commander, commander.args).then(function () {
    reporter.close();
    reporter.footer(true);
    process.exit();
  });
}).catch(function (errs) {
  function logError(err) {
    if (err instanceof MessageError) {
      reporter.error(err.stack);
    } else {
      console.error(err.stack);
    }
  }

  if (Array.isArray(errs)) {
    for (let err of errs) logError(err);
  } else {
    logError(errs);
  }

  process.exit(1);
});
