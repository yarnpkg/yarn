/* @flow */

jest.mock('../../src/util/git/git-spawn.js', () => ({
  spawn: jest.fn(([command]) => {
    switch (command) {
      case 'ls-remote':
        return `ref: refs/heads/master  HEAD
7a053e2ca07d19b2e2eebeeb0c27edaacfd67904        HEAD`;
      case 'rev-list':
        return Promise.resolve('7a053e2ca07d19b2e2eebeeb0c27edaacfd67904 Fix ...');
    }
    return Promise.resolve('');
  }),
}));

import Config from '../../src/config.js';
import Git from '../../src/util/git.js';
import {spawn as spawnGit} from '../../src/util/git/git-spawn.js';
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
  expect(Git.npmUrlToGitUrl('github:npm-opam/ocamlfind.git#v1.2.3')).toEqual({
    protocol: 'ssh:',
    hostname: 'github.com',
    repository: 'ssh://git@github.com/npm-opam/ocamlfind.git#v1.2.3',
  });
  expect(Git.npmUrlToGitUrl('github:npm-opam/ocamlfind#v1.2.3')).toEqual({
    protocol: 'ssh:',
    hostname: 'github.com',
    repository: 'ssh://git@github.com/npm-opam/ocamlfind#v1.2.3',
  });
  expect(Git.npmUrlToGitUrl('github:npm-opam/ocamlfind.git')).toEqual({
    protocol: 'ssh:',
    hostname: 'github.com',
    repository: 'ssh://git@github.com/npm-opam/ocamlfind.git',
  });
  expect(Git.npmUrlToGitUrl('github:npm-opam/ocamlfind')).toEqual({
    protocol: 'ssh:',
    hostname: 'github.com',
    repository: 'ssh://git@github.com/npm-opam/ocamlfind',
  });
});

test('secureGitUrl', async function(): Promise<void> {
  const reporter = new NoopReporter();

  const originalRepoExists = Git.repoExists;
  (Git: any).repoExists = jest.fn();
  Git.repoExists.mockImplementation(() => Promise.resolve(true)).mockImplementationOnce(() => {
    throw new Error('Non-existent repo!');
  });

  let hasException = false;
  try {
    await Git.secureGitUrl(Git.npmUrlToGitUrl('http://fake-fake-fake-fake.com/123.git'), '', reporter);
  } catch (e) {
    hasException = true;
  }
  (Git: any).repoExists = originalRepoExists;
  expect(hasException).toEqual(true);

  let gitURL = await Git.secureGitUrl(Git.npmUrlToGitUrl('http://github.com/yarnpkg/yarn.git'), '', reporter);
  expect(gitURL.repository).toEqual('https://github.com/yarnpkg/yarn.git');

  gitURL = await Git.secureGitUrl(Git.npmUrlToGitUrl('https://github.com/yarnpkg/yarn.git'), '', reporter);
  expect(gitURL.repository).toEqual('https://github.com/yarnpkg/yarn.git');

  gitURL = await Git.secureGitUrl(Git.npmUrlToGitUrl('git://github.com/yarnpkg/yarn.git'), '', reporter);
  expect(gitURL.repository).toEqual('https://github.com/yarnpkg/yarn.git');
});

test('resolveDefaultBranch', async () => {
  const spawnGitMock = (spawnGit: any).mock;
  const config = await Config.create();
  const git = new Git(
    config,
    {
      protocol: '',
      hostname: undefined,
      repository: '',
    },
    '',
  );
  expect(await git.resolveDefaultBranch()).toEqual({
    sha: '7a053e2ca07d19b2e2eebeeb0c27edaacfd67904',
    ref: 'refs/heads/master',
  });
  const lastCall = spawnGitMock.calls[spawnGitMock.calls.length - 1];
  expect(lastCall[0]).toContain('ls-remote');
});

test('resolveCommit', async () => {
  const spawnGitMock = (spawnGit: any).mock;
  const config = await Config.create();
  const git = new Git(
    config,
    {
      protocol: '',
      hostname: undefined,
      repository: '',
    },
    '',
  );
  expect(await git.resolveCommit('7a053e2')).toEqual({
    sha: '7a053e2ca07d19b2e2eebeeb0c27edaacfd67904',
    ref: undefined,
  });
  const lastCall = spawnGitMock.calls[spawnGitMock.calls.length - 1];
  expect(lastCall[0]).toContain('rev-list');
  expect(lastCall[0]).toContain('7a053e2');
});
