/* @flow */

import Git from '../../src/util/git.js';
import {NoopReporter} from '../../src/reporters/index.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

test('cleanUrl', () => {
  expect(Git.cleanUrl('git+https://github.com/npm-opam/ocamlfind.git'))
    .toEqual('https://github.com/npm-opam/ocamlfind.git');
  expect(Git.cleanUrl('https://github.com/npm-opam/ocamlfind.git'))
    .toEqual('https://github.com/npm-opam/ocamlfind.git');
  expect(Git.cleanUrl('git://github.com/npm-opam/ocamlfind.git'))
    .toEqual('git://github.com/npm-opam/ocamlfind.git');
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


test('secureUrl', async function (): Promise<void> {
  const reporter = new NoopReporter();

  let hasException = false;
  try {
    await Git.secureUrl('http://fake-fake-fake-fake.com/123.git', '', reporter);
  } catch (e) {
    hasException = true;
  }
  expect(hasException).toEqual(true);

  let url = await Git.secureUrl('http://github.com/yarnpkg/yarn.git', '', reporter);
  expect(url).toEqual('https://github.com/yarnpkg/yarn.git');

  url = await Git.secureUrl('https://github.com/yarnpkg/yarn.git', '', reporter);
  expect(url).toEqual('https://github.com/yarnpkg/yarn.git');

  url = await Git.secureUrl('git://github.com/yarnpkg/yarn.git', '', reporter);
  expect(url).toEqual('https://github.com/yarnpkg/yarn.git');

},
);
