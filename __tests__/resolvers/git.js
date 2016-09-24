/* @flow */

import GitResolver from '../../src/resolvers/exotics/git-resolver.js';

test("cleanUrl", () => {
  expect(GitResolver.cleanUrl('git+https://github.com/npm-opam/ocamlfind.git')).toEqual('https://github.com/npm-opam/ocamlfind.git');
  expect(GitResolver.cleanUrl('https://github.com/npm-opam/ocamlfind.git')).toEqual('https://github.com/npm-opam/ocamlfind.git');
  expect(GitResolver.cleanUrl('git://github.com/npm-opam/ocamlfind.git')).toEqual('git://github.com/npm-opam/ocamlfind.git');
});
