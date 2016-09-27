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
