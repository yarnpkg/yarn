/* @flow */

import GitLabResolver from '../../../src/resolvers/exotics/gitlab-resolver.js';
import type {ExplodedFragment} from '../../../src/resolvers/exotics/hosted-git-resolver.js';
import Git from '../../../src/util/git.js';

const url = require('url');

test('getGitSSHUrl with hash', () => {
  const gitSSHUrl = GitLabResolver.getGitSSHUrl({
    hash: 'some-hash',
    repo: 'some-repo',
    user: 'some-user',
  });

  expect(gitSSHUrl).toContain('some-hash');
});

test('getGitSSHUrl with no hash', () => {
  const gitSSHUrl = GitLabResolver.getGitSSHUrl({
    hash: '',
    repo: 'some-repo',
    user: 'some-user',
  });

  expect(gitSSHUrl).toContain('some-repo');
  expect(gitSSHUrl).toContain('some-user');
});

test('getGitHTTPBaseUrl should return the correct git gitlab HTTP base url', () => {
  const fragment: ExplodedFragment = {
    user: 'foo',
    repo: 'bar',
    hash: '',
  };

  const expected = 'https://gitlab.com/' + fragment.user + '/' + fragment.repo;
  expect(GitLabResolver.getGitHTTPBaseUrl(fragment)).toBe(expected);
});

test('getGitHTTPUrl should append ".git" to the HTTP base URL', () => {
  const fragment: ExplodedFragment = {
    user: 'foo',
    repo: 'bar',
    hash: '',
  };

  const expected = GitLabResolver.getGitHTTPBaseUrl(fragment) + '.git';
  expect(GitLabResolver.getGitHTTPUrl(fragment)).toBe(expected);
});

test('getGitSSHUrl should return URL containing protocol', () => {
  const gitSSHUrl = GitLabResolver.getGitSSHUrl({
    hash: '',
    repo: 'some-repo',
    user: 'some-user',
  });

  expect(url.parse(gitSSHUrl).protocol).toEqual('git+ssh:');
  expect(Git.npmUrlToGitUrl(gitSSHUrl).protocol).toEqual('ssh:');
});
