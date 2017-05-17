/* @flow */
/* eslint yarn-internal/warn-language: 0 */

import isRequestToRegistry from '../../src/registries/is-request-to-registry.js';

describe('isRequestToRegistry functional test', () => {
  test('request to registry url matching', () => {
    expect(isRequestToRegistry('http://foo.bar:80/foo/bar/baz', 'http://foo.bar/foo/')).toBe(true);

    expect(isRequestToRegistry('http://foo.bar/foo/bar/baz', 'http://foo.bar/foo/')).toBe(true);

    expect(
      isRequestToRegistry('http://foo.bar/foo/00000000-1111-4444-8888-000000000000/baz', 'http://foo.bar/foo/'),
    ).toBe(true);

    expect(isRequestToRegistry('https://foo.bar:443/foo/bar/baz', 'https://foo.bar/foo/')).toBe(true);

    expect(isRequestToRegistry('https://foo.bar/foo/bar/baz', 'https://foo.bar:443/foo/')).toBe(true);

    expect(isRequestToRegistry('https://foo.bar/foo/bar/baz', 'https://foo.bar:443/foo/')).toBe(true);

    expect(isRequestToRegistry('http://foo.bar:80/foo/bar/baz', 'https://foo.bar/foo/')).toBe(true);

    expect(isRequestToRegistry('https://wrong.thing/foo/bar/baz', 'https://foo.bar/foo/')).toBe(false);

    expect(isRequestToRegistry('https://foo.bar:1337/foo/bar/baz', 'https://foo.bar/foo/')).toBe(false);
  });

  test('isRequestToRegistry with custom host prefix', () => {
    expect(
      isRequestToRegistry('http://pkgs.host.com:80/foo/bar/baz', 'http://pkgs.host.com/bar/baz', 'some.host.org'),
    ).toBe(false);

    expect(isRequestToRegistry('http://foo.bar/foo/bar/baz', 'https://foo.bar/foo/bar/baz')).toBe(true);

    expect(
      isRequestToRegistry('http://pkgs.host.com:80/foo/bar/baz', 'http://pkgs.host.com/bar/baz', 'pkgs.host.com'),
    ).toBe(true);
  });
});
