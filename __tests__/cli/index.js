/* @flow */

import {setAliasCmd} from '../../src/cli/index.js';
import aliases from '../../src/cli/aliases.js';

test('setAliasCmd should rewrite "yarn run-script" to "yarn run"', () => {
  expect(setAliasCmd('run-script', aliases)).toBe('run');
});

test('setAliasCmd should rewrite "yarn c" to "yarn config"', () => {
  expect(setAliasCmd('c', aliases)).toBe('config');
});

test('setAliasCmd should rewrite "yarn i" to "yarn install"', () => {
  expect(setAliasCmd('i', aliases)).toBe('install');
});

test('setAliasCmd should rewrite "yarn list" to "yarn ls"', () => {
  expect(setAliasCmd('list', aliases)).toBe('ls');
});

test('setAliasCmd should rewrite "yarn ln" to "yarn link"', () => {
  expect(setAliasCmd('ln', aliases)).toBe('link');
});

test('setAliasCmd should rewrite "yarn rb" to "yarn rebuild"', () => {
  expect(setAliasCmd('rb', aliases)).toBe('rebuild');
});

test('setAliasCmd should rewrite "yarn runScript" to "yarn run"', () => {
  expect(setAliasCmd('runScript', aliases)).toBe('run');
});

test('setAliasCmd should rewrite "yarn t" to "yarn test"', () => {
  expect(setAliasCmd('t', aliases)).toBe('test');
});

test('setAliasCmd should rewrite "yarn tst" to "yarn test"', () => {
  expect(setAliasCmd('tst', aliases)).toBe('test');
});

test('setAliasCmd should rewrite "yarn un" to "yarn remove"', () => {
  expect(setAliasCmd('un', aliases)).toBe('remove');
});

test('setAliasCmd should rewrite "yarn up" to "yarn update"', () => {
  expect(setAliasCmd('up', aliases)).toBe('update');
});

test('setAliasCmd should rewrite "yarn v" to "yarn version"', () => {
  expect(setAliasCmd('v', aliases)).toBe('version');
});
