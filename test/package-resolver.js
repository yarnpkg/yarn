/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
/* eslint max-len: 0 */

import * as reporters from "../src/reporters/index.js";
import PackageResolver from "../src/package-resolver.js";
import Lockfile from "../src/lockfile/index.js";
import Config from "../src/config.js";

let rimraf = require("rimraf");
let path   = require("path");
let test   = require("ava");
let fs     = require("fs");

let tempLoc = path.join(__dirname, "..", ".tmp");

test.before("init", function () {
  return new Promise((resolve, reject) => {
    rimraf(tempLoc, function () {
      fs.mkdir(tempLoc, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
});

test.after("cleanup", function () {
  return new Promise((resolve, reject) => {
    rimraf(tempLoc, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
});

function addTest(pattern, registry = "npm") {
  test(`resolve ${pattern}`, async () => {
    let lockfile = new Lockfile;
    let reporter = new reporters.Noop({});
    let config = new Config(reporter, {
      cwd: tempLoc,
      packagesRoot: tempLoc,
      tempFolder: tempLoc
    });
    await config.init();
    let resolver = new PackageResolver(config, lockfile);
    await resolver.init([{ pattern, registry }]);
    await reporter.close();
  });
}

addTest("github:PolymerElements/paper-elements", "bower"); // github url
addTest("https://github.com/PolymerElements/font-roboto.git", "bower"); // hosted git url
addTest("https://bitbucket.org/hgarcia/node-bitbucket-api.git"); // hosted git url
addTest("https://bitbucket.com/hgarcia/node-bitbucket-api.git"); // git url
addTest("https://github.com/PolymerElements/font-roboto/archive/2fd5c7bd715a24fb5b250298a140a3ba1b71fe46.tar.gz"); // tarball
addTest("gitlab:leanlabsio/kanban"); // gitlab
addTest("gist:d59975ac23e26ad4e25b"); // gist url
addTest("bitbucket:hgarcia/node-bitbucket-api"); // bitbucket url
addTest("scrollin"); // npm
addTest("gulp"); // npm
addTest("react-native"); // npm
addTest("ember-cli"); // npm
addTest("npm:gulp"); // npm
