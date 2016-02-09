/* @flow */

global.Promise = require("bluebird");

import ConsoleReporter from "../reporters/console/index.js";
import { MessageError, BailError } from "../errors.js";
import { hasValidArgLength } from "./arg-utils.js";
import JSONReporter from "../reporters/json.js";
import * as network from "../util/network.js";
import * as commands from "./commands/index.js";
import aliases from "./aliases.js";
import Config from "../config.js";

let loudRejection = require("loud-rejection");
let commander     = require("commander");
let invariant     = require("invariant");
let _             = require("lodash");

loudRejection();

let args = process.argv;

// set global options
commander.version(require("../../package").version);
commander.usage("[command] [flags]");
commander.option("--json", "");
commander.option("--yes", "answer yes to all questions");
commander.option("--no", "answer no to all questions");

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
if (!commandName || !_.has(commands, commandName)) {
  commander.parse(args);
  commander.help();
}

//
invariant(commandName, "Command name required");
let command = commands[_.camelCase(commandName)];
invariant(command, "Command not found");

// parse flags
if (command.setFlags) command.setFlags(commander);
commander.parse(args);

//
let Reporter = ConsoleReporter;
if (commander.json) Reporter = JSONReporter;
let reporter = new Reporter;

//
let config = new Config(reporter);

// print header
reporter.header(commandName);

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

let i = 0;
let profiler = require("v8-profiler");
let fs = require("fs");
profiler.startProfiling('1', true);

function doSnapshot(callback) {
  var snapshot = profiler.takeSnapshot();
  snapshot.export(function (error, result) {
    fs.writeFileSync(`snapshot${i++}.heapsnapshot`, result);
    snapshot.delete();
    callback();
  });
}

//
doSnapshot(function () {
config.init().then(function () {
  let validArgLength = hasValidArgLength(command.argumentLength, command.minArgumentLength, args);

  if (!validArgLength) {
    throw new MessageError(`Invalid argument length for ${commandName}`);
  }

  return command.run(config, reporter, commander, commander.args).then(function () {
    reporter.close();
    reporter.footer();
    doSnapshot(() => process.exit());
  });
}).catch(function (errs) {
  function logError(err) {
    if (err instanceof BailError) {
      // no message
    } else if (err instanceof MessageError) {
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
});
