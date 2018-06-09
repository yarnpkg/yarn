/* @flow */

import {explodeHashedUrl} from '../../src/util/version';

describe('getDataDir', () => {
  test('correctly separates a url with a hash', () => {
    const expectedUrl = 'git+ssh://git@github.com:org/proj.git';
    const expectedHash = 'branch';
    const {url, hash} = explodeHashedUrl(`${expectedUrl}#${expectedHash}`);
    expect(url).toBe(expectedUrl);
    expect(hash).toBe(expectedHash);
  });

  test('returns an empty string as the hash for a url with no hash', () => {
    const expectedUrl = 'git+ssh://git@github.com:org/proj.git';
    const expectedHash = '';
    const {url, hash} = explodeHashedUrl(expectedUrl);
    expect(url).toBe(expectedUrl);
    expect(hash).toBe(expectedHash);
  });

  test('correctly separates a url with a hash in the hash', () => {
    const expectedUrl = 'git+ssh://git@github.com:org/proj.git';
    const expectedHash = 'branch#123';
    const {url, hash} = explodeHashedUrl(`${expectedUrl}#${expectedHash}`);
    expect(url).toBe(expectedUrl);
    expect(hash).toBe(expectedHash);
  });
});
