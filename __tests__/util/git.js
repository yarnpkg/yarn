/* @flow */

import Git from '../../src/util/git.js';
import {NoopReporter} from '../../src/reporters/index.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

test('npmUrlToGitUrl', () => {
  expect(Git.npmUrlToGitUrl('git+https://github.com/npm-opam/ocamlfind.git')).toEqual({
    protocol: 'https:',
    hostname: 'github.com',
    repository: 'https://github.com/npm-opam/ocamlfind.git',
  });
  expect(Git.npmUrlToGitUrl('https://github.com/npm-opam/ocamlfind.git')).toEqual({
    protocol: 'https:',
    hostname: 'github.com',
    repository: 'https://github.com/npm-opam/ocamlfind.git',
  });
  expect(Git.npmUrlToGitUrl('git://github.com/npm-opam/ocamlfind.git')).toEqual({
    protocol: 'git:',
    hostname: 'github.com',
    repository: 'git://github.com/npm-opam/ocamlfind.git',
  });
  expect(Git.npmUrlToGitUrl('git+ssh://git@gitlab.mydomain.tld:10202/project-name/my-package.git')).toEqual({
    protocol: 'ssh:',
    hostname: 'gitlab.mydomain.tld',
    repository: 'ssh://git@gitlab.mydomain.tld:10202/project-name/my-package.git',
  });
  expect(Git.npmUrlToGitUrl('git+ssh://git@github.com/npm-opam/ocamlfind.git')).toEqual({
    protocol: 'ssh:',
    hostname: 'github.com',
    repository: 'ssh://git@github.com/npm-opam/ocamlfind.git',
  });
  expect(Git.npmUrlToGitUrl('git+ssh://scp-host-nickname:npm-opam/ocamlfind.git')).toEqual({
    protocol: 'ssh:',
    hostname: 'scp-host-nickname',
    repository: 'scp-host-nickname:npm-opam/ocamlfind.git',
  });
  expect(Git.npmUrlToGitUrl('git+ssh://user@scp-host-nickname:npm-opam/ocamlfind.git')).toEqual({
    protocol: 'ssh:',
    hostname: 'scp-host-nickname',
    repository: 'user@scp-host-nickname:npm-opam/ocamlfind.git',
  });
});

test('isCommitHash', () => {
  expect(Git.isCommitHash('ca82a6dff817ec66f44312307202690a93763949')).toBeTruthy();
  expect(Git.isCommitHash('abc12')).toBeTruthy();
  expect(Git.isCommitHash('')).toBeFalsy();
  expect(Git.isCommitHash('abc12_')).toBeFalsy();
  expect(Git.isCommitHash('gccda')).toBeFalsy();
  expect(Git.isCommitHash('abC12')).toBeFalsy();
});

test('secureGitUrl', async function(): Promise<void> {
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
});

test('parseRefs', () => {
  expect(Git.parseRefs(`64b2c0cee9e829f73c5ad32b8cc8cb6f3bec65bb refs/tags/v4.2.2`)).toMatchObject({
    'v4.2.2': '64b2c0cee9e829f73c5ad32b8cc8cb6f3bec65bb',
  });

  expect(
    Git.parseRefs(`ebeb6eafceb61dd08441ffe086c77eb472842494  refs/tags/v0.21.0
70e76d174b0c7d001d2cd608a16c94498496e92d  refs/tags/v0.21.0^{}
de43f4a993d1e08cd930ee22ecb2bac727f53449  refs/tags/v0.21.0-pre`),
  ).toMatchObject({
    'v0.21.0': '70e76d174b0c7d001d2cd608a16c94498496e92d',
    'v0.21.0-pre': 'de43f4a993d1e08cd930ee22ecb2bac727f53449',
  });

  expect(
    Git.parseRefs(`**********
This is a custom response header
  as described in: https://github.com/yarnpkg/yarn/issues/3325
**********

ebeb6eafceb61dd08441ffe086c77eb472842494  refs/tags/v0.21.0
70e76d174b0c7d001d2cd608a16c94498496e92d  refs/tags/v0.21.0^{}
de43f4a993d1e08cd930ee22ecb2bac727f53449  refs/tags/v0.21.0-pre`),
  ).toMatchObject({
    'v0.21.0': '70e76d174b0c7d001d2cd608a16c94498496e92d',
    'v0.21.0-pre': 'de43f4a993d1e08cd930ee22ecb2bac727f53449',
  });
});
