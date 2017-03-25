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

test('getGitHTTPUrl should return the correct git gitlab SSH url', () => {
  const fragment: ExplodedFragment = {
    user: 'foo',
    repo: 'bar',
    hash: '',
  };

  const expected =  'git+ssh://git@gitlab.com/' + fragment.user + '/' + fragment.repo + '.git';
  expect(GitLabResolver.getGitSSHUrl(fragment)).toBe(expected);
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
