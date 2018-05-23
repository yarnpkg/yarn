/* @flow */

import { explodeHostedGitFragment } from '../../../src/resolvers/exotics/hosted-git-resolver.js';
import type { ExplodedFragment } from '../../../src/resolvers/exotics/hosted-git-resolver.js';
import * as reporters from '../../../src/reporters/index.js';
const reporter = new reporters.NoopReporter({});

test('explodeHostedGitFragment should allow for hashes as part of the branch name', () => {
  const fragmentString = 'jure/lens#fix-issue-#96';

  const expectedFragment: ExplodedFragment = {
    user: 'jure',
    repo: 'lens',
    hash: 'fix-issue-#96',
  };

  expect(explodeHostedGitFragment(fragmentString, reporter)).toEqual(expectedFragment);
});

test('explodeHostedGitFragment should work for branch names without hashes', () => {
  const fragmentString = 'jure/lens#feature/fix-issue';

  const expectedFragment: ExplodedFragment = {
    user: 'jure',
    repo: 'lens',
    hash: 'feature/fix-issue',
  };

  expect(explodeHostedGitFragment(fragmentString, reporter)).toEqual(expectedFragment);
});

test('explodeHostedGitFragment should work identical with and without .git suffix', () => {
  const fragmentWithGit = 'jure/lens.git#feature/fix-issue';
  const fragmentWithoutGit = 'jure/lens#feature/fix-issue';

  const expectedFragment: ExplodedFragment = {
    user: 'jure',
    repo: 'lens',
    hash: 'feature/fix-issue',
  };

  expect(explodeHostedGitFragment(fragmentWithoutGit, reporter)).toEqual(expectedFragment);
  expect(explodeHostedGitFragment(fragmentWithGit, reporter)).toEqual(expectedFragment);
});

test('explodeHostedGitFragment should allow the project name to contain .git', () => {
  const fragmentString = 'jure/lens.github';

  const expectedFragment: ExplodedFragment = {
    user: 'jure',
    repo: 'lens.github',
    hash: '',
  };

  expect(explodeHostedGitFragment(fragmentString, reporter)).toEqual(expectedFragment);
});

test('explodeHostedGitFragment should allow the hash to contain semver', () => {
  const fragmentString = 'jure/lens#semver:^3.0.0';

  const expectedFragment: ExplodedFragment = {
    user: 'jure',
    repo: 'lens',
    hash: 'semver:^3.0.0',
  };

  expect(explodeHostedGitFragment(fragmentString, reporter)).toEqual(expectedFragment);
});
