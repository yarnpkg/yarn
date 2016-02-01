/* @flow */

import ConsoleReporter from "../reporters/console";
import { MessageError, BailError } from "../errors";
import { hasValidArgLength } from "./arg-utils";
import JSONReporter from "../reporters/json";
import * as network from "../util/network";
import * as commands from "./commands";
import aliases from "./aliases";
import Config from "../config";

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

// handle flags that can cause automatic responses to cli questions
let alwaysAnswer;
if (commander.no) alwaysAnswer = "n";
if (commander.yes) alwaysAnswer = "y";

//
let reporter = new Reporter({ alwaysAnswer });

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

//
config.initialise().then(function () {
  let validArgLength = hasValidArgLength(command.argumentLength, command.minArgumentLength, args);

  if (!validArgLength) {
    throw new MessageError(`Invalid argument length for ${commandName}`);
  }

  return command.run(config, reporter, commander, commander.args).then(function () {
    reporter.footer();
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
