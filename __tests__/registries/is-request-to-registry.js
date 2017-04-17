/* @flow */
/* eslint yarn-internal/warn-language: 0 */

import isRequestToRegistry from '../../src/registries/is-request-to-registry.js';

test('isRequestToRegistry functional test', () => {
  expect(isRequestToRegistry(
    'http://foo.bar:80/foo/bar/baz',
    'http://foo.bar/foo/',
  )).toBe(true);

  expect(isRequestToRegistry(
    'http://foo.bar/foo/bar/baz',
    'http://foo.bar/foo/',
  )).toBe(true);

  expect(isRequestToRegistry(
    'https://foo.bar:443/foo/bar/baz',
    'https://foo.bar/foo/',
  )).toBe(true);

  expect(isRequestToRegistry(
    'https://foo.bar/foo/bar/baz',
    'https://foo.bar:443/foo/',
  )).toBe(true);

  expect(isRequestToRegistry(
    'http://foo.bar:80/foo/bar/baz',
    'https://foo.bar/foo/',
  )).toBe(true);

  expect(isRequestToRegistry(
    'http://foo.bar/blah/whatever/something',
    'http://foo.bar/foo/',
  )).toBe(false);

  expect(isRequestToRegistry(
    'https://wrong.thing/foo/bar/baz',
    'https://foo.bar/foo/',
  )).toBe(false);

  expect(isRequestToRegistry(
    'https://foo.bar:1337/foo/bar/baz',
    'https://foo.bar/foo/',
  )).toBe(false);

  expect(isRequestToRegistry(
    'http://foo.bar/foo/bar/baz',
    'https://foo.bar/foo/bar/baz',
  )).toBe(true);
});
