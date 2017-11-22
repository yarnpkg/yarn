/* @flow */

import path from 'path';

jest.mock('../../../src/util/child.js', () => {
  const realChild = (require: any).requireActual('../../../src/util/child.js');

  realChild.spawn = jest.fn(() => Promise.resolve(''));

  return realChild;
});

function runGit(args, opts): any {
  const {spawn} = require('../../../src/util/child.js');
  const {spawn: spawnGit} = require('../../../src/util/git/git-spawn.js');
  const spawnMock = (spawn: any).mock;

  spawnGit(args, opts);

  return spawnMock.calls[0];
}

describe('spawn', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('spawn with default', () => {
    process.env.GIT_SSH_COMMAND = '';
    const gitCall = runGit(['status']);
    delete process.env.GIT_SSH_COMMAND;

    expect(gitCall[2].env).toMatchObject({
      GIT_ASKPASS: '',
      GIT_TERMINAL_PROMPT: 0,
      GIT_SSH_COMMAND: '"ssh" -oBatchMode=yes',
      GIT_SSH_VARIANT: 'ssh',
      ...process.env,
    });
  });

  test('spawn with plink', () => {
    process.env.GIT_SSH_COMMAND = '';
    // Test for case-sensitivity too (should be insensitive)
    const plinkPath = path.join('C:', 'pLink.EXE');
    process.env.GIT_SSH = plinkPath;

    const gitCall = runGit(['status']);
    delete process.env.GIT_SSH_COMMAND;

    delete process.env.GIT_SSH;

    expect(gitCall[2].env).toMatchObject({
      GIT_ASKPASS: '',
      GIT_TERMINAL_PROMPT: 0,
      GIT_SSH_COMMAND: `"${plinkPath}" -batch`,
      GIT_SSH_VARIANT: 'plink',
      ...process.env,
    });
  });

  test('spawn with custom GIT_SSH', () => {
    process.env.GIT_SSH_COMMAND = '';
    process.env.GIT_SSH = 'custom-ssh.sh';
    const gitCall = runGit(['status']);

    delete process.env.GIT_SSH;
    delete process.env.GIT_SSH_COMMAND;

    const calledEnv = gitCall[2].env;
    expect(calledEnv).toMatchObject({
      GIT_ASKPASS: '',
      GIT_TERMINAL_PROMPT: 0,
      GIT_SSH_COMMAND: '',
      ...process.env,
    });
  });

  test('spawn with custom GIT_SSH_COMMAND', () => {
    process.env.GIT_SSH_COMMAND = 'some-custom-ssh.sh';
    const gitCall = runGit(['status']);

    delete process.env.GIT_SSH_COMMAND;

    const calledEnv = gitCall[2].env;
    expect(calledEnv).toMatchObject({
      GIT_ASKPASS: '',
      GIT_TERMINAL_PROMPT: 0,
      GIT_SSH_COMMAND: 'some-custom-ssh.sh',
      ...process.env,
    });
  });
});
