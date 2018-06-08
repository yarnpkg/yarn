/* @flow */

import GitResolver from '../../../src/resolvers/exotics/git-resolver.js';

test('isVersion true for ssh: protocol', () => {
  expect(GitResolver.isVersion('ssh://git@github.com/sindresorhus/beeper.git')).toBe(true);
});

test('isVersion true for git: protocol', () => {
  expect(GitResolver.isVersion('git://git@github.com/sindresorhus/beeper.git')).toBe(true);
});

test('isVersion true for git+ssh: protocol', () => {
  expect(GitResolver.isVersion('git+ssh://git@github.com/sindresorhus/beeper.git')).toBe(true);
});

test('isVersion true for http: protocol when ends with .git', () => {
  expect(GitResolver.isVersion('http://example.com/sindresorhus/beeper.git')).toBe(true);
});

test('isVersion true for http: protocol when ends with .git and hash', () => {
  expect(GitResolver.isVersion('http://example.com/sindresorhus/beeper.git#branch')).toBe(true);
});

test('isVersion false for http: protocol when does not end with .git', () => {
  expect(GitResolver.isVersion('http://example.com/sindresorhus/beeper')).toBe(false);
});

test('isVersion false for http: protocol when does not end with .git with hash', () => {
  expect(GitResolver.isVersion('http://example.com/sindresorhus/beeper#branch')).toBe(false);
});

test('isVersion true for https: protocol when ends with .git', () => {
  expect(GitResolver.isVersion('https://example.com/sindresorhus/beeper.git')).toBe(true);
});

test('isVersion true for https: protocol when ends with .git and hash', () => {
  expect(GitResolver.isVersion('https://example.com/sindresorhus/beeper.git#branch')).toBe(true);
});

test('isVersion false for https: protocol when does not end with .git', () => {
  expect(GitResolver.isVersion('https://example.com/sindresorhus/beeper')).toBe(false);
});

test('isVersion false for https: protocol when does not end with .git with hash', () => {
  expect(GitResolver.isVersion('https://example.com/sindresorhus/beeper#branch')).toBe(false);
});

test('isVersion false for file: protocol when ends with .git', () => {
  expect(GitResolver.isVersion('file:../project.git')).toBe(false);
});

test('isVersion true for any github.com repo url', () => {
  expect(GitResolver.isVersion('foo://github.com/sindresorhus/beeper')).toBe(true);
});

test('isVersion true for any gitlab.com repo url', () => {
  expect(GitResolver.isVersion('foo://gitlab.com/sindresorhus/beeper')).toBe(true);
});

test('isVersion true for any bitbucket.com repo url', () => {
  expect(GitResolver.isVersion('foo://bitbucket.com/sindresorhus/beeper')).toBe(true);
});

test('isVersion false for any github url to archive file', () => {
  expect(GitResolver.isVersion('http://github.com/sindresorhus/beeper/archive/v1.0.0.tar.gz')).toBe(false);
});
