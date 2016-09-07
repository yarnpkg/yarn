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

let objs = [
  {foo: "bar"},
  {foo: {}},
  {foo: "foo", bar: "bar"},
  {foo: 5},
];

let i = 0;
for (let obj of objs) {
  test(`parse/stringify ${++i}`, () => {
    expect(parse(stringify(obj))).toEqual(nullify(obj));
  });
}

test("parse", () => {
  expect(parse('foo "bar"')).toEqual(nullify({foo: "bar"}));
  expect(parse('"foo" "bar"')).toEqual(nullify({foo: "bar"}));
  expect(parse('foo "bar"')).toEqual(nullify({foo: "bar"}));

  expect(parse(`foo:\n  bar "bar"`)).toEqual(nullify({foo: {bar: "bar"}}));
  expect(parse(`foo:\n  bar:\n  foo "bar"`)).toEqual(nullify({foo: {bar: {}, foo: "bar"}}));
  expect(parse(`foo:\n  bar:\n    foo "bar"`)).toEqual(nullify({foo: {bar: {foo: "bar"}}}));
  expect(parse("foo:\n  bar:\n    yes no\nbar:\n  yes no")).toEqual(nullify({
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

test("stringify", () => {
  let obj = {foo: "bar"};
  expect(stringify({a: obj, b: obj}, true)).toEqual("a, b:\n  foo bar");
});

test("Lockfile.fromDirectory", () => {

});

test("Lockfile.getLocked", () => {
  let lockfile = new Lockfile({
    foo: "bar",
    bar: {},
  });
  expect(!!lockfile.getLocked("foo")).toBeTruthy();
});

test("Lockfile.getLocked pointer", () => {
  let lockfile = new Lockfile({
    foo: "bar",
    bar: {},
  });
  expect(!!lockfile.getLocked("foo")).toBeTruthy();
});

test("Lockfile.getLocked no cache", () => {
  expect(!new Lockfile().getLocked("foobar")).toBeTruthy();
});

test("Lockfile.getLocked defaults", () => {
  let pattern = new Lockfile({
    foobar: {
      version: "0.0.0",
    },
  }).getLocked("foobar");
  expect(pattern.registry).toBe("npm");
  expect(pattern.uid).toBe("0.0.0");
  expect(pattern.version).toBe("0.0.0");
});

test("Lockfile.getLocked unknown", () => {
  new Lockfile({}).getLocked("foobar");
});

test("Lockfile.getLockfile", () => {
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

  expect(actual).toEqual(expected);
});

test("Lockfile.getLockfile (sorting)", () => {
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

  expect(actual).toEqual(expected);
});
