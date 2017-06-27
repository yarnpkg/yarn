/* @flow */

import {getExoticResolver} from '../../src/resolvers/index.js';
// exotic resolvers
import GitResolver from '../../src/resolvers/exotics/git-resolver.js';
import GistResolver from '../../src/resolvers/exotics/gist-resolver.js';
import RegistryResolver from '../../src/resolvers/exotics/registry-resolver.js';
import TarballResolver from '../../src/resolvers/exotics/tarball-resolver.js';
// registry resolvers
import NpmRegistryResolver from '../../src/resolvers/registries/npm-resolver.js';
import YarnRegistryResolver from '../../src/resolvers/registries/yarn-resolver.js';

test('getExoticResolver does not return a Resolver for 0.0.0 pattern', () => {
  const pattern = '0.0.0';
  expect(getExoticResolver(pattern)).toEqual(null);
});

test('getExoticResolver returns NPM Registry Resolver for npm:0.0.0 pattern', () => {
  const pattern = 'npm:0.0.0';
  const resolver = getExoticResolver(pattern);
  expect(resolver).toBeDefined();
  expect(resolver && resolver.prototype).toBeInstanceOf(RegistryResolver);
  expect(resolver && resolver.factory).toEqual(NpmRegistryResolver);
});

test('getExoticResolver returns Yarn Registry Resolver for yarn:0.0.0 pattern', () => {
  const pattern = 'yarn:0.0.0';
  const resolver = getExoticResolver(pattern);
  expect(resolver).toBeDefined();
  expect(resolver && resolver.prototype).toBeInstanceOf(RegistryResolver);
  expect(resolver && resolver.factory).toEqual(YarnRegistryResolver);
});

test('getExoticResolver returns Git Resolver for git+ssh://... pattern', () => {
  const pattern = 'git+ssh://user@hostname/path/repo#master';
  expect(getExoticResolver(pattern)).toEqual(GitResolver);
});

test('getExoticResolver returns Git Resolver for git+https://... pattern', () => {
  const pattern = 'git+https://hostname/path/repo#master';
  expect(getExoticResolver(pattern)).toEqual(GitResolver);
});

test('getExoticResolver returns Git Resolver for git+file:///... pattern', () => {
  const pattern = 'git+file:///path/repo#master';
  expect(getExoticResolver(pattern)).toEqual(GitResolver);
});

test('getExoticResolver returns Git Resolver for git://... pattern', () => {
  const pattern = 'git://user@hostname/path/repo#master';
  expect(getExoticResolver(pattern)).toEqual(GitResolver);
});

test('getExoticResolver returns Git Resolver for ssh://... pattern', () => {
  const pattern = 'ssh://user@hostname/path/repo#master';
  expect(getExoticResolver(pattern)).toEqual(GitResolver);
});

test('getExoticResolver returns Git Resolver for http://... pattern with .git extension', () => {
  const pattern = 'http://hostname/path/repo.git#master';
  expect(getExoticResolver(pattern)).toEqual(GitResolver);
});

test('getExoticResolver returns Git Resolver for https://... pattern with .git extension', () => {
  const pattern = 'https://hostname/path/repo.git#master';
  expect(getExoticResolver(pattern)).toEqual(GitResolver);
});

test('getExoticResolver returns Tarball Resolver for http://... pattern', () => {
  const pattern = 'http://hostname/path/file.tgz';
  expect(getExoticResolver(pattern)).toEqual(TarballResolver);
});

test('getExoticResolver returns Tarball Resolver for https://... pattern', () => {
  const pattern = 'https://hostname/path/file.tgz';
  expect(getExoticResolver(pattern)).toEqual(TarballResolver);
});

test('getExoticResolver returns Gist Resolver for gist://... pattern', () => {
  const pattern = 'gist:id#hash';
  expect(getExoticResolver(pattern)).toEqual(GistResolver);
});
