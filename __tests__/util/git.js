/* @flow */

import Git from '../../src/util/git.js';

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

test('assertUrl', () => {
  expect(() => Git.assertUrl('http://random.repo', ''))
    .toThrow();
  expect(() => Git.assertUrl('http://random.repo', 'ab_12'))
    .toThrow();
  expect(() => Git.assertUrl('git://random.repo', ''))
    .toThrow();
  expect(() => Git.assertUrl('https://random.repo', ''))
    .not.toThrow();
  expect(() => Git.assertUrl('http://random.repo', 'abc12'))
    .not.toThrow();
  expect(() => Git.assertUrl('git://random.repo', 'abc12'))
    .not.toThrow();
});
