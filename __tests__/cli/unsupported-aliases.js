/* @flow */

import unsupportedAliases from '../../src/cli/unsupported-aliases.js';

test('shorthands and affordances', () => {
  expect(unsupportedAliases['run-script']).toBe('run');
  expect(unsupportedAliases['c']).toBe('config');
  expect(unsupportedAliases['i']).toBe('install');
  expect(unsupportedAliases['ls']).toBe('list');
  expect(unsupportedAliases['rb']).toBe('rebuild');
  expect(unsupportedAliases['runScript']).toBe('run');
  expect(unsupportedAliases['t']).toBe('test');
  expect(unsupportedAliases['tst']).toBe('test');
  expect(unsupportedAliases['un']).toBe('remove');
  expect(unsupportedAliases['up']).toBe('upgrade');
  expect(unsupportedAliases['v']).toBe('version');
  expect(unsupportedAliases['add-user']).toBe('login');
  expect(unsupportedAliases['dist-tag']).toBe('tag');
  expect(unsupportedAliases['dist-tags']).toBe('tag');
  expect(unsupportedAliases['adduser']).toBe('login');
  expect(unsupportedAliases['author']).toBe('owner');
  expect(unsupportedAliases['isntall']).toBe('install');
  expect(unsupportedAliases['la']).toBe('list');
  expect(unsupportedAliases['ll']).toBe('list');
  expect(unsupportedAliases['r']).toBe('remove');
  expect(unsupportedAliases['rm']).toBe('remove');
  expect(unsupportedAliases['show']).toBe('info');
  expect(unsupportedAliases['uninstall']).toBe('remove');
  expect(unsupportedAliases['update']).toBe('upgrade');
  expect(unsupportedAliases['verison']).toBe('version');
  expect(unsupportedAliases['view']).toBe('info');
});
