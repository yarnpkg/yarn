/* @flow */

jest.mock('../../src/util/git/git-spawn.js', () => ({
  spawn: jest.fn(([command]) => {
    switch (command) {
      case 'ls-remote':
        return `Identity added: /Users/example/.ssh/id_dsa (/Users/example/.ssh/id_dsa)
ref: refs/heads/master  HEAD
7a053e2ca07d19b2e2eebeeb0c27edaacfd67904        HEAD`;
      case 'rev-list':
        return Promise.resolve('7a053e2ca07d19b2e2eebeeb0c27edaacfd67904 Fix ...');
      case 'show-ref':
        return `7a053e2ca07d19b2e2eebeeb0c27edaacfd67904 refs/remotes/origin/HEAD`;
    }
    return Promise.resolve('');
  }),
}));

import Config from '../../src/config.js';
import Git from '../../src/util/git.js';
import {spawn as spawnGit} from '../../src/util/git/git-spawn.js';
import {NoopReporter, BufferReporter} from '../../src/reporters/index.js';

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
    repository: 'ssh://git@github.com/npm-opam/ocamlfind.git',
  });
  expect(Git.npmUrlToGitUrl('github:npm-opam/ocamlfind#v1.2.3')).toEqual({
    protocol: 'ssh:',
    hostname: 'github.com',
    repository: 'ssh://git@github.com/npm-opam/ocamlfind',
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
  expect(Git.npmUrlToGitUrl('git+file:../ocalmfind.git')).toEqual({
    protocol: 'file:',
    hostname: null,
    repository: '../ocalmfind.git',
  });
  expect(Git.npmUrlToGitUrl('git+file:../ocalmfind')).toEqual({
    protocol: 'file:',
    hostname: null,
    repository: '../ocalmfind',
  });
});

describe('secureGitUrl()', function() {
  it('accepts URLs with commit hash', async () => {
    // "accept" means it returns the Url unchanged and doesn't report a warning
    // Assume the all the repos exist
    const mock = jest.spyOn(Git, 'repoExists').mockImplementation(() => true);

    // Test it for all the supported protocols
    for (const protocol of ['http:', 'https:', 'git:', 'ssh:']) {
      const inputurl = protocol + '//example.com/repo.git';
      const hash = '0123456789abcdef0123456789abcdef';
      const reporter = new BufferReporter();
      const secureUrl = await Git.secureGitUrl(Git.npmUrlToGitUrl(inputurl), hash, reporter);
      expect(secureUrl.repository).toEqual(inputurl);
      expect(reporter.getBuffer()).toEqual([]);
    }

    mock.mockRestore();
  });

  it('accepts URLs without commit hash over secure protocols', async () => {
    const mock = jest.spyOn(Git, 'repoExists').mockImplementation(() => true);
    for (const protocol of ['https:', 'ssh:']) {
      const inputurl = protocol + '//example.com/repo.git';
      const reporter = new BufferReporter();
      const secureUrl = await Git.secureGitUrl(Git.npmUrlToGitUrl(inputurl), '', reporter);
      expect(secureUrl.repository).toEqual(inputurl);
      expect(reporter.getBuffer()).toEqual([]);
    }
    mock.mockRestore();
  });

  it('changes insecure URLs to HTTPS', async () => {
    // Assume the HTTPS URLs exist
    const mock = jest.spyOn(Git, 'repoExists').mockImplementation(() => true);
    for (const protocol of ['http:', 'git:']) {
      const inputurl = protocol + '//example.com/repo.git';
      const reporter = new BufferReporter();
      const secureUrl = await Git.secureGitUrl(Git.npmUrlToGitUrl(inputurl), '', reporter);
      expect(secureUrl.repository).toEqual('https://example.com/repo.git');
      expect(reporter.getBuffer()).toEqual([]);
    }
    mock.mockRestore();
  });

  it('warns if insecure URLs cannot be changed to HTTPS', async () => {
    // Assume the HTTPS URLs don't exist
    const mock = jest.spyOn(Git, 'repoExists').mockImplementation(() => false);
    for (const protocol of ['http:', 'git:']) {
      const inputurl = protocol + '//example.com/repo.git';
      const reporter = new BufferReporter();
      const secureUrl = await Git.secureGitUrl(Git.npmUrlToGitUrl(inputurl), '', reporter);
      expect(secureUrl.repository).toEqual(inputurl);
      expect(reporter.getBuffer()).toEqual([
        {
          type: 'warning',
          error: true,
          data: reporter.lang(protocol == 'git:' ? 'downloadGitWithoutCommit' : 'downloadHTTPWithoutCommit', inputurl),
        },
      ]);
    }
    mock.mockRestore();
  });

  // In case some test case didn't clean up correctly, for example if it failed with an exception
  afterAll(() => {
    // restoreAllMocks() is included in jest >= 21.1.0, but only known in flow-typed for jest >= 22.0.0
    (jest: any).restoreAllMocks();
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

test('resolveDefaultBranch when local', async () => {
  const spawnGitMock = (spawnGit: any).mock;
  const config = await Config.create();
  const git = new Git(
    config,
    {
      protocol: 'file:',
      hostname: undefined,
      repository: 'example',
    },
    '',
  );
  expect(await git.resolveDefaultBranch()).toEqual({
    sha: '7a053e2ca07d19b2e2eebeeb0c27edaacfd67904',
    ref: undefined,
  });
  const lastCall = spawnGitMock.calls[spawnGitMock.calls.length - 1];
  expect(lastCall[0]).toContain('show-ref');
});

test('resolveDefaultBranch when remote', async () => {
  const spawnGitMock = (spawnGit: any).mock;
  const config = await Config.create();
  const git = new Git(
    config,
    {
      protocol: 'https:',
      hostname: '//example.com',
      repository: 'example',
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
