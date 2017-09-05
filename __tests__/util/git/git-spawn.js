/* @flow */

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
    const gitCall = runGit(['status']);

    expect(gitCall[2].env).toMatchObject({
      GIT_ASKPASS: '',
      GIT_TERMINAL_PROMPT: 0,
      GIT_SSH_COMMAND: 'ssh -oBatchMode=yes',
      ...process.env,
    });
  });

  test('spawn with plink', () => {
    // Test for case-sensitivity too (should be insensitive)
    process.env.GIT_SSH = 'C:\\pLink.EXE';

    const gitCall = runGit(['status']);

    delete process.env.GIT_SSH;

    expect(gitCall[2].env).toMatchObject({
      GIT_ASKPASS: '',
      GIT_TERMINAL_PROMPT: 0,
      GIT_SSH_COMMAND: 'C:\\pLink.EXE -batch',
      ...process.env,
    });
  });

  test('spawn with custom GIT_SSH', () => {
    process.env.GIT_SSH = 'custom-ssh.sh';
    const gitCall = runGit(['status']);

    delete process.env.GIT_SSH;

    const calledEnv = gitCall[2].env;
    expect(calledEnv).toMatchObject({
      GIT_ASKPASS: '',
      GIT_TERMINAL_PROMPT: 0,
      ...process.env,
    });
    expect(calledEnv).not.toHaveProperty('GIT_SSH_COMMAND');
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
