/* @flow */
import {explodeHostedGitFragment} from '../../../src/resolvers/exotics/hosted-git-resolver.js';
import BitBucketResolver from '../../../src/resolvers/exotics/bitbucket-resolver.js';
import type {ExplodedFragment} from '../../../src/resolvers/exotics/hosted-git-resolver.js';
import Git from '../../../src/util/git.js';
import * as reporters from '../../../src/reporters/index.js';

const url = require('url');
const _bitBucketBase = 'https://bitbucket.org/';
const reporter = new reporters.NoopReporter({});

test('hostname should be "bitbucket.org" ', () => {
  expect(BitBucketResolver.hostname).toBe('bitbucket.org');
});

test('protocol should be "bitbucket" ', () => {
  expect(BitBucketResolver.protocol).toBe('bitbucket');
});

test('explodeHostedGitFragment should work for colon separator after host', () => {
  const fragmentString = 'git@bitbucket.org:team2/repo.git';

  const expectedFragment: ExplodedFragment = {
    user: 'team2',
    repo: 'repo',
    hash: '',
  };

  expect(explodeHostedGitFragment(fragmentString, reporter)).toEqual(expectedFragment);
});

test('explodeHostedGitFragment should work for colon separator after host and with protocol before', () => {
  const fragmentString = 'git+ssh://git@bitbucket.org:team/repo.git';

  const expectedFragment: ExplodedFragment = {
    user: 'team',
    repo: 'repo',
    hash: '',
  };

  expect(explodeHostedGitFragment(fragmentString, reporter)).toEqual(expectedFragment);
});

test('explodeHostedGitFragment should work for slash separator after host', () => {
  const fragmentString = 'git@bitbucket.org/team/repo.git';

  const expectedFragment: ExplodedFragment = {
    user: 'team',
    repo: 'repo',
    hash: '',
  };

  expect(explodeHostedGitFragment(fragmentString, reporter)).toEqual(expectedFragment);
});

test('explodeHostedGitFragment should work for package name and colon separator after host', () => {
  const fragmentString = 'package@git@bitbucket.org:team/repo.git';

  const expectedFragment: ExplodedFragment = {
    user: 'team',
    repo: 'repo',
    hash: '',
  };

  expect(explodeHostedGitFragment(fragmentString, reporter)).toEqual(expectedFragment);
});

test('getTarballUrl should return the correct bitbucket tarball url', () => {
  const fragment: ExplodedFragment = {
    user: 'foo',
    repo: 'bar',
    hash: '',
  };
  const hash = 'baz';
  const expected = _bitBucketBase + fragment.user + '/' + fragment.repo + '/get/' + hash + '.tar.gz';
  expect(BitBucketResolver.getTarballUrl(fragment, hash)).toBe(expected);
});

test('getGitHTTPBaseUrl should return the correct git bitbucket base url', () => {
  const fragment: ExplodedFragment = {
    user: 'foo',
    repo: 'bar',
    hash: '',
  };

  const expected = _bitBucketBase + fragment.user + '/' + fragment.repo;
  expect(BitBucketResolver.getGitHTTPBaseUrl(fragment)).toBe(expected);
});

test('getGitHTTPUrl should append ".git" to the HTTP base URL', () => {
  const fragment: ExplodedFragment = {
    user: 'foo',
    repo: 'bar',
    hash: '',
  };

  const expected = BitBucketResolver.getGitHTTPBaseUrl(fragment) + '.git';
  expect(BitBucketResolver.getGitHTTPUrl(fragment)).toBe(expected);
});

test('getGitHTTPUrl should return the correct git bitbucket SSH url', () => {
  const fragment: ExplodedFragment = {
    user: 'foo',
    repo: 'bar',
    hash: '',
  };

  const expected = 'git+ssh://git@bitbucket.org/' + fragment.user + '/' + fragment.repo + '.git';
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

  const expected = _bitBucketBase + fragment.user + '/' + fragment.repo + '/raw/' + commit + '/' + filename;
  expect(BitBucketResolver.getHTTPFileUrl(fragment, filename, commit)).toBe(expected);
});

test('getGitSSHUrl should return URL containing protocol', () => {
  const gitSSHUrl = BitBucketResolver.getGitSSHUrl({
    hash: '',
    repo: 'some-repo',
    user: 'some-user',
  });

  expect(url.parse(gitSSHUrl).protocol).toEqual('git+ssh:');
  expect(Git.npmUrlToGitUrl(gitSSHUrl).protocol).toEqual('ssh:');
});
