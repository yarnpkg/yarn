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

test('getGitHTTPUrl should return the correct git github SSH url', () => {
  const fragment: ExplodedFragment = {
    user: 'foo',
    repo: 'bar',
    hash: '',
  };

  const expected =  'git+ssh://git@github.com/' + fragment.user + '/' + fragment.repo + '.git';
  expect(GitHubResolver.getGitSSHUrl(fragment)).toBe(expected);
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
