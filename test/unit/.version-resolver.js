import PackageRequest from "../../lib/package-request";
import * as constants from "../../lib/constants";

let test = require("ava");

test("finds versions in range", (t) => {
  t.plan(1);

  let found = PackageRequest.findVersionInRegistryResponse("0.0.1", {
    name: "test",
    "dist-tags": {},
    versions: {
      "0.0.1": {foo: "bar"},
      "0.2.0": {},
    },
  });

  t.is(JSON.stringify(found), JSON.stringify({foo: "bar"}));
});

test("validates version info", (t) => {
  t.plan(2);

  const fn = PackageRequest.validateVersionInfo;

  t.throws(PackageRequest);

  t.doesNotThrow(fn.bind({},
    constants.REQUIRED_PACKAGE_KEYS.reduce((prev, curr) => {
      prev[curr] = "hi";
      return prev;
    }, {})));
});

test("get package version", (t) => {
  t.plan(2);

  const fn = PackageRequest.getPackageVersion;

  t.is(fn({version: "dog"}), "dog");
  t.is(fn({}), "0.0.0");
});

test("find potential git tags", (t) => {
  t.plan(4);

  const fn = PackageRequest.findPotentialGitTag;

  t.is(fn("*", []), "master");
  t.is(fn(undefined, []), "master");
  t.is(fn("foo", []), "foo");
  t.is(fn("v0.1.0", [
    "v0.2.0",
    "v1.0.0",
    "kittens",
    "v0.1.0"
  ]), "v0.1.0");
});
