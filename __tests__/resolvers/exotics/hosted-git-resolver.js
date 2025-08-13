/* @flow */

import {explodeHostedGitFragment} from '../../../src/resolvers/exotics/hosted-git-resolver.js';
import * as reporters from '../../../src/reporters/index.js';
const reporter = new reporters.NoopReporter({});

[
  {fragment: 'jure/lens#fix-issue-#96', user: 'jure', repo: 'lens', hash: 'fix-issue-#96'},
  {fragment: 'jure/lens#feature/fix-issue', user: 'jure', repo: 'lens', hash: 'feature/fix-issue'},
  {fragment: 'jure/lens.github', user: 'jure', repo: 'lens.github', hash: ''},
  {fragment: 'jure/lens#semver:^3.0.0', user: 'jure', repo: 'lens', hash: 'semver:^3.0.0'},
  {fragment: 'github:jure/lens', user: 'jure', repo: 'lens', hash: ''},
  {fragment: 'bitbucket:jure/lens', user: 'jure', repo: 'lens', hash: ''},
  {fragment: 'git+ssh://git@github.com:jure/lens', user: 'jure', repo: 'lens', hash: ''},
  {fragment: 'git+ssh://git@github.com:jure/lens.git', user: 'jure', repo: 'lens', hash: ''},
  {fragment: 'git://git@github.com:jure/lens.git', user: 'jure', repo: 'lens', hash: ''},
  {fragment: 'git+https://login@github.com/jure/lens.git', user: 'jure', repo: 'lens', hash: ''},
  {fragment: 'git+ssh://git@github.com/jure/lens.git#semver:^3.1.0', user: 'jure', repo: 'lens', hash: 'semver:^3.1.0'},
  {fragment: 'git+http://login@github.com/jure/lens.git', user: 'jure', repo: 'lens', hash: ''},
].forEach(({fragment, user, repo, hash}) => {
  test(`explodeHostedGitFragment ${fragment} -> user: '${user}'`, () => {
    expect(explodeHostedGitFragment(fragment, reporter).user).toEqual(user);
  });
  test(`explodeHostedGitFragment ${fragment} -> repo: '${repo}'`, () => {
    expect(explodeHostedGitFragment(fragment, reporter).repo).toEqual(repo);
  });
  test(`explodeHostedGitFragment ${fragment} -> hash: '${hash}'`, () => {
    expect(explodeHostedGitFragment(fragment, reporter).hash).toEqual(hash);
  });
});
