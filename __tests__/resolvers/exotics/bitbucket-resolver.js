/* @flow */

import BitBucketResolver from '../../../src/resolvers/exotics/bitbucket-resolver.js';
import type {ExplodedFragment} from '../../../src/resolvers/exotics/hosted-git-resolver.js';
import Git from '../../../src/util/git.js';

const url = require('url');
const _bitBucketBase = 'https://bitbucket.org/';

test('hostname should be "bitbucket.org" ', () => {
  expect(BitBucketResolver.hostname).toBe('bitbucket.org');
});

test('protocol should be "bitbucket" ', () => {
  expect(BitBucketResolver.protocol).toBe('bitbucket');
});

test('getTarballUrl should return the correct bitbucket tarball url', () => {
  const fragment: ExplodedFragment = {
    user: 'foo',
    repo: 'bar',
    hash: '',
  };
  const hash = 'baz';
  const expected =  _bitBucketBase + fragment.user + '/' + fragment.repo + '/get/' + hash + '.tar.gz';
  expect(BitBucketResolver.getTarballUrl(fragment, hash)).toBe(expected);
});

test('getGitHTTPUrl should return the correct git bitbucket url', () => {
  const fragment: ExplodedFragment = {
    user: 'foo',
    repo: 'bar',
    hash: '',
  };

  const expected =  _bitBucketBase + fragment.user + '/' + fragment.repo + '.git';
  expect(BitBucketResolver.getGitHTTPUrl(fragment)).toBe(expected);
});

test('getGitHTTPUrl should return the correct git bitbucket SSH url', () => {
  const fragment: ExplodedFragment = {
    user: 'foo',
    repo: 'bar',
    hash: '',
  };

  const expected =  'git+ssh://git@bitbucket.org/' + fragment.user + '/' + fragment.repo + '.git';
  expect(BitBucketResolver.getGitSSHUrl(fragment)).toBe(expected);
});

test('getHTTPFileUrl should return the correct HTTP file url', () => {
  const fragment: ExplodedFragment = {
    user: 'foo',
    repo: 'bar',
    hash: '',
  };

  const commit = 'abc123';
  const filename = 'baz.js';

  const expected =  _bitBucketBase + fragment.user + '/' + fragment.repo + '/raw/' + commit + '/' + filename;
  expect(BitBucketResolver.getHTTPFileUrl(fragment, filename, commit)).toBe(expected);
});

test('getGitSSHUrl should return URL containing protocol', () => {
  const gitSSHUrl = BitBucketResolver.getGitSSHUrl({
    hash: '',
    repo: 'some-repo',
    user: 'some-user',
  });

  expect(url.parse(gitSSHUrl).protocol).toEqual('git+ssh:');
  expect(url.parse(Git.cleanUrl(gitSSHUrl)).protocol).toEqual('ssh:');
});
