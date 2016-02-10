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

import { reporters, PackageResolver, Lockfile, Config } from "..";

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

addTest("PolymerElements/paper-elements", "bower");
addTest("scrollin");
addTest("gulp");
addTest("react-native");
addTest("ember-cli");
