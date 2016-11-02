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

async function toThrow(f): Promise <boolean> {
  try {
    await f();
    return false;
  } catch (e) {
    return true;
  }
}

test('secureUrl', async function (): Promise<void> {
  expect(await
         toThrow(() => {
           return Git.secureUrl('http://random.repo', '');
         }),
        ).toEqual(true);

  expect(await
         toThrow(() => {
           return Git.secureUrl('http://random.repo', 'ab_12');
         }),
        ).toEqual(true);

  expect(await
         toThrow(() => {
           return Git.secureUrl('git://random.repo', '');
         }),
        ).toEqual(true);

  expect(await
         toThrow(() => {
           return Git.secureUrl('https://random.repo', '');
         }),
        ).toEqual(false);

  expect(await
         toThrow(() => {
           return Git.secureUrl('http://random.repo', 'abc12');
         }),
        ).toEqual(false);

  expect(await
         toThrow(() => {
           return Git.secureUrl('git://random.repo', 'abc12');
         }),
        ).toEqual(false);
},
);
