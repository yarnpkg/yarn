/* @flow */

import parsePackagePath, {isValidPackagePath} from '../../src/util/parse-package-path.js';

test('parsePackagePath', () => {
  expect(parsePackagePath('foo/bar/baz')).toEqual(['foo', 'bar', 'baz']);
  expect(parsePackagePath('@foo/bar/baz')).toEqual(['@foo/bar', 'baz']);
  expect(parsePackagePath('@foo/bar/@foo/baz')).toEqual(['@foo/bar', '@foo/baz']);
  expect(parsePackagePath('invalidname/')).toEqual(['invalidname']);
});

test('isValidPackagePath', () => {
  expect(isValidPackagePath('foo/bar/baz')).toEqual(true);
  expect(isValidPackagePath('@foo/bar/baz')).toEqual(true);
  expect(isValidPackagePath('@foo/bar/@foo/baz')).toEqual(true);
  expect(isValidPackagePath('invalidname/')).toEqual(false);
  expect(isValidPackagePath('invalidname//invalidname')).toEqual(false);
  expect(isValidPackagePath('invalidname/invalidname/*')).toEqual(false);
});
