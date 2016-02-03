import { reporters, PackageResolver, Lockfile, Config } from "../..";

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
    let shrinkwrap = new Lockfile;
    let reporter = new reporters.Noop({});
    let config = new Config(reporter, {
      cwd: tempLoc,
      packagesRoot: tempLoc,
      tempFolder: tempLoc
    });
    let resolver = new PackageResolver(config, reporter, shrinkwrap);
    return resolver.init([{ pattern, registry }]);
  });
}

addTest("PolymerElements/paper-elements", "bower");
addTest("scrollin");
addTest("gulp");
addTest("react-native");
addTest("ember-cli");
