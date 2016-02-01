import parse from "../../lib/lockfile/parse";
import stringify from "../../lib/lockfile/stringify";

let nullify = require("../../lib/util/map").default;
let test    = require("ava");

test("lockfile.parse", (t) => {
  t.plan(6);

  t.same(parse(`foo "bar"`), nullify({ foo: "bar" }));
  t.same(parse(`"foo" "bar"`), nullify({ foo: "bar" }));
  t.same(parse(`foo "bar"`), nullify({ foo: "bar" }));

  t.same(parse(`foo:\n  bar "bar"`), nullify({ foo: { bar: "bar" } }));
  t.same(parse(`foo:\n  bar:\n  foo "bar"`), nullify({ foo: { bar: {}, foo: "bar" } }));
  t.same(parse(`foo:\n  bar:\n    foo "bar"`), nullify({ foo: { bar: { foo: "bar" } } }));
});

test("lockfile.stringify", (t) => {
  stringify;
  t;
});
