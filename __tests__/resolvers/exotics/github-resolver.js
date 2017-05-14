/* @flow */

import GitHubResolver from '../../../src/resolvers/exotics/github-resolver.js';
import type {ExplodedFragment} from '../../../src/resolvers/exotics/hosted-git-resolver.js';
import Git from '../../../src/util/git.js';

const url = require('url');

test('getGitSSHUrl with hash', () => {
  const gitSSHUrl = GitHubResolver.getGitSSHUrl({
    hash: 'some-hash',
    repo: 'some-repo',
    user: 'some-user',
  });

  expect(gitSSHUrl).toContain('some-hash');
});

test('getGitSSHUrl with no hash', () => {
  const gitSSHUrl = GitHubResolver.getGitSSHUrl({
    hash: '',
    repo: 'some-repo',
    user: 'some-user',
  });

  expect(gitSSHUrl).toContain('some-repo');
  expect(gitSSHUrl).toContain('some-user');
});

test('getGitHTTPBaseUrl should return the correct git github HTTP base url', () => {
  const fragment: ExplodedFragment = {
    user: 'foo',
    repo: 'bar',
    hash: '',
  };

  const expected = 'https://github.com/' + fragment.user + '/' + fragment.repo;
  expect(GitHubResolver.getGitHTTPBaseUrl(fragment)).toBe(expected);
});

test('getGitHTTPUrl should append ".git" to the HTTP base URL', () => {
  const fragment: ExplodedFragment = {
    user: 'foo',
    repo: 'bar',
    hash: '',
  };

  const expected = GitHubResolver.getGitHTTPBaseUrl(fragment) + '.git';
  expect(GitHubResolver.getGitHTTPUrl(fragment)).toBe(expected);
});

test('getGitSSHUrl should return URL containing protocol', () => {
  const gitSSHUrl = GitHubResolver.getGitSSHUrl({
    hash: '',
    repo: 'some-repo',
    user: 'some-user',
  });

  expect(url.parse(gitSSHUrl).protocol).toEqual('git+ssh:');
  expect(Git.npmUrlToGitUrl(gitSSHUrl).protocol).toEqual('ssh:');
});
