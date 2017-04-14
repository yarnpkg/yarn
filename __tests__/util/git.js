/* @flow */

import Git from '../../src/util/git.js';
import {NoopReporter} from '../../src/reporters/index.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

test('npmUrlToGitUrl', () => {
  expect(Git.npmUrlToGitUrl('git+https://github.com/npm-opam/ocamlfind.git'))
    .toEqual({
      protocol: 'https:',
      hostname: 'github.com',
      repository: 'https://github.com/npm-opam/ocamlfind.git',
    });
  expect(Git.npmUrlToGitUrl('https://github.com/npm-opam/ocamlfind.git'))
    .toEqual({
      protocol: 'https:',
      hostname: 'github.com',
      repository: 'https://github.com/npm-opam/ocamlfind.git',
    });
  expect(Git.npmUrlToGitUrl('git://github.com/npm-opam/ocamlfind.git'))
    .toEqual({
      protocol: 'git:',
      hostname: 'github.com',
      repository: 'git://github.com/npm-opam/ocamlfind.git',
    });
  expect(Git.npmUrlToGitUrl('git+ssh://git@gitlab.mydomain.tld:10202/project-name/my-package.git'))
    .toEqual({
      protocol: 'ssh:',
      hostname: 'gitlab.mydomain.tld',
      repository: 'ssh://git@gitlab.mydomain.tld:10202/project-name/my-package.git',
    });
  expect(Git.npmUrlToGitUrl('git+ssh://git@github.com/npm-opam/ocamlfind.git'))
    .toEqual({
      protocol: 'ssh:',
      hostname: 'github.com',
      repository: 'ssh://git@github.com/npm-opam/ocamlfind.git',
    });
  expect(Git.npmUrlToGitUrl('git+ssh://scp-host-nickname:npm-opam/ocamlfind.git'))
    .toEqual({
      protocol: 'ssh:',
      hostname: 'scp-host-nickname',
      repository: 'scp-host-nickname:npm-opam/ocamlfind.git',
    });
  expect(Git.npmUrlToGitUrl('git+ssh://user@scp-host-nickname:npm-opam/ocamlfind.git'))
    .toEqual({
      protocol: 'ssh:',
      hostname: 'scp-host-nickname',
      repository: 'user@scp-host-nickname:npm-opam/ocamlfind.git',
    });
});

test('isCommitHash', () => {
  expect(Git.isCommitHash('ca82a6dff817ec66f44312307202690a93763949'))
    .toBeTruthy();
  expect(Git.isCommitHash('abc12'))
    .toBeTruthy();
  expect(Git.isCommitHash(''))
    .toBeFalsy();
  expect(Git.isCommitHash('abc12_'))
    .toBeFalsy();
  expect(Git.isCommitHash('gccda'))
    .toBeFalsy();
  expect(Git.isCommitHash('abC12'))
    .toBeFalsy();
});


test('secureGitUrl', async function (): Promise<void> {
  const reporter = new NoopReporter();

  let hasException = false;
  try {
    await Git.secureGitUrl(Git.npmUrlToGitUrl('http://fake-fake-fake-fake.com/123.git'), '', reporter);
  } catch (e) {
    hasException = true;
  }
  expect(hasException).toEqual(true);

  let gitURL = await Git.secureGitUrl(Git.npmUrlToGitUrl('http://github.com/yarnpkg/yarn.git'), '', reporter);
  expect(gitURL.repository).toEqual('https://github.com/yarnpkg/yarn.git');

  gitURL = await Git.secureGitUrl(Git.npmUrlToGitUrl('https://github.com/yarnpkg/yarn.git'), '', reporter);
  expect(gitURL.repository).toEqual('https://github.com/yarnpkg/yarn.git');

  gitURL = await Git.secureGitUrl(Git.npmUrlToGitUrl('git://github.com/yarnpkg/yarn.git'), '', reporter);
  expect(gitURL.repository).toEqual('https://github.com/yarnpkg/yarn.git');

},
);
