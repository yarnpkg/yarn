/* @flow */
/* eslint quotes: 0 */

import Lockfile from '../src/lockfile';
import stringify from '../src/lockfile/stringify.js';
import parse from '../src/lockfile/parse.js';
import nullify from '../src/util/map.js';

const ssri = require('ssri');

const objs = [{foo: 'bar'}, {foo: {}}, {foo: 'foo', bar: 'bar'}, {foo: 5}];

let i = 0;
for (const obj of objs) {
  test(`parse/stringify ${++i}`, () => {
    expect(parse(stringify(obj)).object).toEqual(nullify(obj));
  });
}

test('parse', () => {
  // Yaml
  expect(parse('foo:\n  bar\n').object).toEqual(nullify({foo: 'bar'}));

  expect(parse('foo "bar"').object).toEqual(nullify({foo: 'bar'}));
  expect(parse('"foo" "bar"').object).toEqual(nullify({foo: 'bar'}));
  expect(parse('foo "bar"').object).toEqual(nullify({foo: 'bar'}));

  expect(parse(`foo:\n  bar "bar"`).object).toEqual(nullify({foo: {bar: 'bar'}}));
  expect(parse(`foo:\n  bar:\n  foo "bar"`).object).toEqual(nullify({foo: {bar: {}, foo: 'bar'}}));
  expect(parse(`foo:\n  bar:\n    foo "bar"`).object).toEqual(nullify({foo: {bar: {foo: 'bar'}}}));
  expect(parse(`foo:\r\n  bar:\r\n    foo "bar"`).object).toEqual(nullify({foo: {bar: {foo: 'bar'}}}));
  expect(parse('foo:\n  bar:\n    yes no\nbar:\n  yes no').object).toEqual(
    nullify({
      foo: {
        bar: {
          yes: 'no',
        },
      },
      bar: {
        yes: 'no',
      },
    }),
  );
  expect(parse('foo:\r\n  bar:\r\n    yes no\r\nbar:\r\n  yes no').object).toEqual(
    nullify({
      foo: {
        bar: {
          yes: 'no',
        },
      },
      bar: {
        yes: 'no',
      },
    }),
  );
});

test('stringify', () => {
  const obj = {foo: 'bar'};
  expect(stringify({a: obj, b: obj}, true)).toEqual('a, b:\n  foo bar\n');
});

test('Lockfile.fromDirectory', () => {});

test('Lockfile.getLocked', () => {
  const lockfile = new Lockfile({
    cache: {
      foo: 'bar',
      bar: {},
    },
  });
  expect(!!lockfile.getLocked('foo')).toBeTruthy();
});

test('Lockfile.getLocked pointer', () => {
  const lockfile = new Lockfile({
    cache: {
      foo: 'bar',
      bar: {},
    },
  });
  expect(!!lockfile.getLocked('foo')).toBeTruthy();
});

test('Lockfile.getLocked no cache', () => {
  expect(!new Lockfile().getLocked('foobar')).toBeTruthy();
});

test('Lockfile.getLocked defaults', () => {
  const pattern = new Lockfile({
    cache: {
      foobar: {
        version: '0.0.0',
      },
    },
  }).getLocked('foobar');
  expect(pattern.registry).toBe('npm');
  expect(pattern.uid).toBe('0.0.0');
  expect(pattern.version).toBe('0.0.0');
});

test('Lockfile.getLocked unknown', () => {
  new Lockfile({cache: {}}).getLocked('foobar');
});

test('Lockfile.getLockfile', () => {
  const patterns = {
    foobar: {
      name: 'foobar',
      version: '0.0.0',
      _uid: '0.0.0',
      dependencies: {},
      optionalDependencies: {},
      _reference: {
        permissions: {},
      },
      _remote: {
        resolved: 'http://example.com/foobar',
        registry: 'npm',
      },
    },

    barfoo: {
      name: 'barfoo',
      version: '0.0.1',
      _uid: '0.1.0',
      dependencies: {
        yes: 'no',
      },
      optionalDependencies: {
        no: 'yes',
      },
      _reference: {
        permissions: {
          foo: 'bar',
        },
      },
      _remote: {
        resolved: 'http://example.com/barfoo',
        registry: 'yarn',
      },
    },

    'foobar@2': {},
  };

  patterns['foobar@2'] = patterns.foobar;

  const actual = new Lockfile().getLockfile(patterns);

  const expectedFoobar = {
    version: '0.0.0',
    uid: undefined,
    resolved: 'http://example.com/foobar',
    registry: undefined,
    dependencies: undefined,
    optionalDependencies: undefined,
    permissions: undefined,
  };

  const expected = {
    barfoo: {
      version: '0.0.1',
      uid: '0.1.0',
      resolved: 'http://example.com/barfoo',
      registry: 'yarn',
      dependencies: {yes: 'no'},
      optionalDependencies: {no: 'yes'},
      permissions: {foo: 'bar'},
    },
    foobar: expectedFoobar,
    'foobar@2': expectedFoobar,
  };

  expect(actual).toEqual(expected);
});

test('Lockfile.getLockfile (sorting)', () => {
  const patterns = {
    foobar2: {
      name: 'foobar',
      version: '0.0.0',
      uid: '0.0.0',
      dependencies: {},
      optionalDependencies: {},
      _reference: {
        permissions: {},
      },
      _remote: {
        resolved: 'http://example.com/foobar',
        registry: 'npm',
      },
    },

    foobar1: {},
  };

  patterns.foobar1 = patterns.foobar2;

  const actual = new Lockfile().getLockfile(patterns);

  const expectedFoobar = {
    name: 'foobar',
    version: '0.0.0',
    uid: undefined,
    resolved: 'http://example.com/foobar',
    registry: undefined,
    dependencies: undefined,
    optionalDependencies: undefined,
    permissions: undefined,
  };

  const expected = {
    foobar1: expectedFoobar,
    foobar2: expectedFoobar,
  };

  expect(actual).toEqual(expected);
});

test('Lockfile.getLockfile handles integrity field', () => {
  const integrity = ssri.parse('sha1-foo sha512-bar');
  const patterns = {
    foobar: {
      name: 'foobar',
      version: '0.0.0',
      uid: '0.0.0',
      dependencies: {},
      optionalDependencies: {},
      _reference: {
        permissions: {},
      },
      _remote: {
        resolved: 'http://example.com/foobar',
        registry: 'npm',
        integrity,
      },
    },
  };

  const actual = new Lockfile().getLockfile(patterns);

  const expected = {
    foobar: {
      version: '0.0.0',
      uid: undefined,
      resolved: 'http://example.com/foobar',
      registry: undefined,
      dependencies: undefined,
      optionalDependencies: undefined,
      permissions: undefined,
      integrity: integrity.toString().split(' ').sort().join(' '),
    },
  };

  expect(actual).toEqual(expected);
});

test('parse single merge conflict', () => {
  const file = `
a:
  no "yes"

<<<<<<< HEAD
b:
  foo "bar"
=======
c:
  bar "foo"
>>>>>>> branch-a

d:
  yes "no"
`;

  const {type, object} = parse(file);
  expect(type).toEqual('merge');
  expect(object).toEqual({
    a: {no: 'yes'},
    b: {foo: 'bar'},
    c: {bar: 'foo'},
    d: {yes: 'no'},
  });
});

test('parse single merge conflict with CRLF', () => {
  const file =
    'a:\r\n  no "yes"\r\n\r\n<<<<<<< HEAD\r\nb:\r\n  foo "bar"' +
    '\r\n=======\r\nc:\r\n  bar "foo"\r\n>>>>>>> branch-a' +
    '\r\n\r\nd:\r\n  yes "no"\r\n';

  const {type, object} = parse(file);
  expect(type).toEqual('merge');
  expect(object).toEqual({
    a: {no: 'yes'},
    b: {foo: 'bar'},
    c: {bar: 'foo'},
    d: {yes: 'no'},
  });
});

test('parse multiple merge conflicts', () => {
  const file = `
a:
  no "yes"

<<<<<<< HEAD
b:
  foo "bar"
=======
c:
  bar "foo"
>>>>>>> branch-a

d:
  yes "no"

<<<<<<< HEAD
e:
  foo "bar"
=======
f:
  bar "foo"
>>>>>>> branch-b
`;

  const {type, object} = parse(file);
  expect(type).toEqual('merge');
  expect(object).toEqual({
    a: {no: 'yes'},
    b: {foo: 'bar'},
    c: {bar: 'foo'},
    d: {yes: 'no'},
    e: {foo: 'bar'},
    f: {bar: 'foo'},
  });
});

test('parse merge conflict fail', () => {
  const file = `
<<<<<<< HEAD
b:
  foo: "bar
=======
c:
  bar "foo"
>>>>>>> branch-a
`;

  const {type, object} = parse(file);
  expect(type).toEqual('conflict');
  expect(Object.keys(object).length).toEqual(0);
});

test('discards common ancestors in merge conflicts', () => {
  const file = `
<<<<<<< HEAD
b:
  foo "bar"
||||||| common ancestor
d:
  yes "no"
=======
c:
  bar "foo"
>>>>>>> branch-a
`;

  const {type, object} = parse(file);
  expect(type).toEqual('merge');
  expect(object).toEqual({
    b: {foo: 'bar'},
    c: {bar: 'foo'},
  });
  expect(object.d).toBe(undefined);
});
