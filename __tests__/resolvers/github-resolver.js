/* @flow */

import GitHubResolver from '../../src/resolvers/exotics/github-resolver.js';

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
