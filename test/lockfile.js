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
/* eslint quotes: 0 */

import Lockfile from "../src/lockfile/wrapper.js";
import stringify from "../src/lockfile/stringify.js";
import parse from "../src/lockfile/parse.js";
import nullify from "../src/util/map.js";

let test = require('ava');

let objs = [
  {foo: "bar"},
  {foo: {}},
  {foo: "foo", bar: "bar"},
  {foo: 5},
];

let i = 0;
for (let obj of objs) {
  test(`parse/stringify ${++i}`, (t) => {
    t.deepEqual(parse(stringify(obj)), nullify(obj));
  });
}

test("parse", (t) => {
  t.deepEqual(parse('foo "bar"'), nullify({foo: "bar"}));
  t.deepEqual(parse('"foo" "bar"'), nullify({foo: "bar"}));
  t.deepEqual(parse('foo "bar"'), nullify({foo: "bar"}));

  t.deepEqual(parse(`foo:\n  bar "bar"`), nullify({foo: {bar: "bar"}}));
  t.deepEqual(parse(`foo:\n  bar:\n  foo "bar"`), nullify({foo: {bar: {}, foo: "bar"}}));
  t.deepEqual(parse(`foo:\n  bar:\n    foo "bar"`), nullify({foo: {bar: {foo: "bar"}}}));
  t.deepEqual(parse("foo:\n  bar:\n    yes no\nbar:\n  yes no"), nullify({
    foo: {
      bar: {
        yes: "no",
      },
    },
    bar: {
      yes: "no",
    },
  }));
});

test("stringify", (t) => {
  let obj = {foo: "bar"};
  t.deepEqual(stringify({a: obj, b: obj}, true), "a, b:\n  foo bar");
});

test("Lockfile.fromDirectory", () => {

});

test("Lockfile.getLocked", (t) => {
  let lockfile = new Lockfile({
    foo: "bar",
    bar: {},
  });
  t.is(!!lockfile.getLocked("foo"), true);
});

test("Lockfile.getLocked pointer", (t) => {
  let lockfile = new Lockfile({
    foo: "bar",
    bar: {},
  });
  t.is(!!lockfile.getLocked("foo"), true);
});

test("Lockfile.getLocked no cache", (t) => {
  t.is(!new Lockfile().getLocked("foobar"), true);
});

test("Lockfile.getLocked defaults", (t) => {
  let pattern = new Lockfile({
    foobar: {
      version: "0.0.0",
    },
  }).getLocked("foobar");
  t.is(pattern.registry, "npm");
  t.is(pattern.uid, "0.0.0");
  t.is(pattern.version, "0.0.0");
});

test("Lockfile.getLocked unknown", () => {
  new Lockfile({}).getLocked("foobar");
});

test("Lockfile.getLockfile", (t) => {
  let patterns = {
    foobar: {
      name: "foobar",
      version: "0.0.0",
      _uid: "0.0.0",
      dependencies: {},
      optionalDependencies: {},
      _reference: {
        permissions: {},
      },
      _remote: {
        resolved: "http://example.com/foobar",
        registry: "npm",
      },
    },

    barfoo: {
      name: "barfoo",
      version: "0.0.1",
      _uid: "0.1.0",
      dependencies: {
        yes: "no",
      },
      optionalDependencies: {
        no: "yes",
      },
      _reference: {
        permissions: {
          foo: "bar",
        },
      },
      _remote: {
        resolved: "http://example.com/barfoo",
        registry: "bower",
      },
    },

    "foobar@2": {},
  };

  patterns["foobar@2"] = patterns.foobar;

  let actual = new Lockfile().getLockfile(patterns);

  let expectedFoobar = {
    name: undefined,
    version: "0.0.0",
    uid: undefined,
    resolved: "http://example.com/foobar",
    registry: undefined,
    dependencies: undefined,
    optionalDependencies: undefined,
    permissions: undefined,
  };

  let expected = {
    barfoo: {
      name: undefined,
      version: "0.0.1",
      uid: "0.1.0",
      resolved: "http://example.com/barfoo",
      registry: "bower",
      dependencies: {yes: "no"},
      optionalDependencies: {no: "yes"},
      permissions: {foo: "bar"},
    },
    foobar: expectedFoobar,
    "foobar@2": expectedFoobar,
  };

  t.deepEqual(actual, expected);
});

test("Lockfile.getLockfile (sorting)", (t) => {
  let patterns = {
    foobar2: {
      name: "foobar",
      version: "0.0.0",
      uid: "0.0.0",
      dependencies: {},
      optionalDependencies: {},
      _reference: {
        permissions: {},
      },
      _remote: {
        resolved: "http://example.com/foobar",
        registry: "npm",
      },
    },

    foobar1: {},
  };

  patterns.foobar1 = patterns.foobar2;

  let actual = new Lockfile().getLockfile(patterns);

  let expectedFoobar = {
    name: "foobar",
    version: "0.0.0",
    uid: undefined,
    resolved: "http://example.com/foobar",
    registry: undefined,
    dependencies: undefined,
    optionalDependencies: undefined,
    permissions: undefined,
  };

  let expected = {
    foobar1: expectedFoobar,
    foobar2: expectedFoobar,
  };

  t.deepEqual(actual, expected);
});
