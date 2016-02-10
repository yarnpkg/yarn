import { analyse } from "..";

let expect = require("unexpected");
let path   = require("path");
let test   = require("ava");
let fs     = require("fs");

let fixturesLoc = path.join(__dirname, "fixtures", "analysis");

for (let name of fs.readdirSync(fixturesLoc)) {
  let loc = path.join(fixturesLoc, name);

  let a = path.join(loc, "a");
  let b = path.join(loc, "b");

  let expected = require(path.join(loc, "expected.json"));

  test(name, async function () {
    let actual = await analyse(a, b);

    // the unexpected library does a "subset" comparison
    expect(actual, "to satisfy", expected);
  });
}
