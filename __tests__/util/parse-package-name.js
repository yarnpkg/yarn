/* @flow */

import parsePackageName from '../../src/util/parse-package-name.js';

test('parsePackageName', () => {
  expect(parsePackageName('foo@1.2.3'))
    .toEqual({
      name: 'foo',
      version: '1.2.3',
    });

  expect(parsePackageName('foo'))
    .toEqual({
      name: 'foo',
    });

  expect(parsePackageName('q'))
    .toEqual({
      name: 'q',
    });

  expect(parsePackageName('q@1.2.3'))
    .toEqual({
      name: 'q',
      version: '1.2.3',
    });
});
