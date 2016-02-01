import parse from "../../lib/lockfile/parse";
import stringify from "../../lib/lockfile/stringify";

let nullify = require("../../lib/util/map").default;
let test    = require("ava");

let objs = [
  { foo: "bar" },
  { foo: {} },
  { foo: "foo", bar: "bar" },
  require("../../package.json")
];

test("lockfile.parse/stringify", (t) => {
  t.plan(objs.length);

  for (let obj of objs) {
    t.same(parse(stringify(obj)), nullify(obj));
  }
});
