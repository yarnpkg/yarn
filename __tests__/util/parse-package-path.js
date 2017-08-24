/* @flow */

import parsePackagePath from '../../src/util/parse-package-path.js';

test('parsePackagePath', () => {
  expect(parsePackagePath('foo/bar/baz')).toEqual(['foo', 'bar', 'baz']);
  expect(parsePackagePath('@foo/bar/baz')).toEqual(['@foo/bar', 'baz']);
  expect(parsePackagePath('@foo/bar/@foo/baz')).toEqual(['@foo/bar', '@foo/baz']);
  expect(parsePackagePath('invalidname/')).toEqual(['invalidname', '']);
});
