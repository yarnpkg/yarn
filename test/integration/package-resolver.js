import PackageResolver from "../../lib/packaging/package-resolver";
import Shrinkwrap from "../../lib/packaging/shrinkwrap";
import Reporter from "../../lib/reporters/_base";
import Config from "../../lib/config";

let test = require("ava");

function addTest(pattern, source = "npm") {
  test(`resolve ${pattern}`, t => {
    let shrinkwrap = new Shrinkwrap;
    let reporter = new Reporter({});
    let config = new Config;
    let resolver = new PackageResolver(config, reporter, shrinkwrap);
    return resolver.init([{ pattern, source }]);
  });
}

addTest("PolymerElements/paper-elements", "bower");
addTest("scrollin");
addTest("gulp");
addTest("react-native");
addTest("ember-cli");
