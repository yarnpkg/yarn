/* @flow */

jest.mock('../../../src/util/child.js', () => {
  const realChild = (require: any).requireActual('../../../src/util/child.js');

  realChild.spawn = jest.fn(() => Promise.resolve(''));

  return realChild;
});

import {spawn as spawnGit} from '../../../src/util/git/git-spawn.js';
import {spawn} from '../../../src/util/child.js';

test('spawn', () => {
  const spawnMock = (spawn: any).mock;

  spawnGit(['status']);

  expect(spawnMock.calls[0][2].env).toMatchObject({
    GIT_ASKPASS: '',
    GIT_TERMINAL_PROMPT: 0,
    GIT_SSH_COMMAND: 'ssh -oBatchMode=yes',
    ...process.env,
  });
});
