import { reporters, PackageResolver, Lockfile, Config } from "../../lib";

let test = require("ava");

function addTest(pattern, registry = "npm") {
  test(`resolve ${pattern}`, t => {
    let shrinkwrap = new Lockfile;
    let reporter = new reporters.Noop({});
    let config = new Config;
    let resolver = new PackageResolver(config, reporter, shrinkwrap);
    return resolver.init([{ pattern, registry }]);
  });
}

addTest("PolymerElements/paper-elements", "bower");
addTest("scrollin");
addTest("gulp");
addTest("react-native");
addTest("ember-cli");
