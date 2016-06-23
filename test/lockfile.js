/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
/* eslint quotes: 0 */

import Lockfile from "../src/lockfile/index.js";
import stringify from "../src/lockfile/stringify.js";
import parse from "../src/lockfile/parse.js";
import nullify from "../src/util/map.js";

let test = require("ava");

let objs = [
  { foo: "bar" },
  { foo: {} },
  { foo: "foo", bar: "bar" },
  { foo: 5 },
  Object.assign({}, require("../package.json"), { ava: {} })
];

let i = 0;
for (let obj of objs) {
  test(`parse/stringify ${++i}`, (t) => {
    t.deepEqual(parse(stringify(obj)), nullify(obj));
  });
}

test("parse", (t) => {
  t.deepEqual(parse('foo "bar"'), nullify({ foo: "bar" }));
  t.deepEqual(parse('"foo" "bar"'), nullify({ foo: "bar" }));
  t.deepEqual(parse('foo "bar"'), nullify({ foo: "bar" }));

  t.deepEqual(parse(`foo:\n  bar "bar"`), nullify({ foo: { bar: "bar" } }));
  t.deepEqual(parse(`foo:\n  bar:\n  foo "bar"`), nullify({ foo: { bar: {}, foo: "bar" } }));
  t.deepEqual(parse(`foo:\n  bar:\n    foo "bar"`), nullify({ foo: { bar: { foo: "bar" } } }));
  t.deepEqual(parse("foo:\n  bar:\n    yes no\nbar:\n  yes no"), nullify({
    foo: {
      bar: {
        yes: "no"
      }
    },
    bar: {
      yes: "no"
    }
  }));
});

test("stringify", (t) => {
  stringify;
  t;
});

test("Lockfile.isStrict", (t) => {
  t.is(new Lockfile(null, true).isStrict(), true);
  t.is(new Lockfile(null, false).isStrict(), false);
  t.is(new Lockfile(null).isStrict(), false);
});

test("Lockfile.fromDirectory", () => {

});

test("Lockfile.getLocked", (t) => {

  let lockfile = new Lockfile({
    foo: "bar",
    bar: {}
  });
  t.truthy(!!lockfile.getLocked("foo"));
});

test("Lockfile.getLocked pointer", (t) => {
  let lockfile = new Lockfile({
    foo: "bar",
    bar: {}
  });
  t.truthy(!!lockfile.getLocked("foo"));
});

test("Lockfile.getLocked no cache", (t) => {
  t.truthy(!new Lockfile().getLocked("foobar"));
});

test("Lockfile.getLocked defaults", (t) => {
  let pattern = new Lockfile({
    foobar: {
      version: "0.0.0"
    }
  }).getLocked("foobar");
  t.is(pattern.registry, "npm");
  t.is(pattern.uid, "0.0.0");
  t.is(pattern.version, "0.0.0");
});

test("Lockfile.getLocked strict unknown", (t) => {
  new Lockfile({}, false).getLocked("foobar");
  t.throws(function () {
    new Lockfile({}, true).getLocked("foobar");
  }, "The pattern foobar not found in lockfile");
});

test("Lockfile.getLockfile", (t) => {
  let patterns = {
    foobar: {
      name: "foobar",
      version: "0.0.0",
      uid: "0.0.0",
      dependencies: {},
      optionalDependencies: {},
      reference: {
        permissions: {}
      },
      remote: {
        resolved: "http://example.com",
        registry: "npm"
      }
    },

    barfoo: {
      name: "barfoo",
      version: "0.0.1",
      uid: "0.1.0",
      dependencies: {
        yes: "no"
      },
      optionalDependencies: {
        no: "yes"
      },
      reference: {
        permissions: {
          foo: "bar"
        }
      },
      remote: {
        resolved: "http://example.com",
        registry: "bower"
      }
    }
  };

  patterns.foobar2 = patterns.foobar;

  let actual = new Lockfile().getLockfile(patterns);

  let expected = {
    foobar: {
      name: "foobar",
      version: "0.0.0",
      uid: undefined,
      resolved: "http://example.com",
      registry: undefined,
      dependencies: undefined,
      optionalDependencies: undefined,
      permissions: undefined
    },

    barfoo: {
      name: "barfoo",
      version: "0.0.1",
      uid: "0.1.0",
      resolved: "http://example.com",
      registry: "bower",
      dependencies: { yes: "no" },
      optionalDependencies: { no: "yes" },
      permissions: { foo: "bar" }
    },

    foobar2: "foobar"
  };

  t.deepEqual(actual, expected);
});
