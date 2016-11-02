/* @flow */

import aliases from '../../src/cli/aliases.js';

test('shorthands and affordances', () => {
  expect(aliases['run-script']).toBe('run');
  expect(aliases['c']).toBe('config');
  expect(aliases['i']).toBe('install');
  expect(aliases['list']).toBe('ls');
  expect(aliases['rb']).toBe('rebuild');
  expect(aliases['runScript']).toBe('run');
  expect(aliases['t']).toBe('test');
  expect(aliases['tst']).toBe('test');
  expect(aliases['un']).toBe('remove');
  expect(aliases['up']).toBe('update');
  expect(aliases['v']).toBe('info');
  expect(aliases['add-user']).toBe('login');
  expect(aliases['dist-tag']).toBe('tag');
  expect(aliases['dist-tags']).toBe('tag');
  expect(aliases['adduser']).toBe('login');
  expect(aliases['author']).toBe('owner');
  expect(aliases['isntall']).toBe('install');
  expect(aliases['la']).toBe('ls');
  expect(aliases['ll']).toBe('ls');
  expect(aliases['r']).toBe('remove');
  expect(aliases['rm']).toBe('remove');
  expect(aliases['show']).toBe('info');
  expect(aliases['uninstall']).toBe('remove');
  expect(aliases['update']).toBe('upgrade');
  expect(aliases['verison']).toBe('version');
  expect(aliases['view']).toBe('info');
});
