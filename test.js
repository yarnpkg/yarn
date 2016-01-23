"use strict";

let Config = require("./lib/config").default;
let Git    = require("./lib/util/git").default;

let config = new Config;

config.initialise().then(function () {
  let client = new Git(config, "git@gitlab.com:gitlab-org/gitlab-ce.git", "v0.9.5");

  return client.init().then(function () {
    return client.getFile("README.md").then(console.log, console.error);
  }, console.error);
}, console.error);
