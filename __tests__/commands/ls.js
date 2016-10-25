/* @flow */

import * as ls from '../../src/cli/commands/ls.js';

test('getParent should extract a parent object from a hash, if the parent key exists', () => {
  const mockTreesByKey = {};

  mockTreesByKey['parentPkg'] = {
    name: 'parent@1.1.1',
    children: [],
  };
  const res = ls.getParent('parentPkg#childPkg', mockTreesByKey);
  
  expect(res instanceof Object).toBe(true);
  expect(res.name).toBe('parent@1.1.1');
  expect(res.children.length).toBe(0);
});

test('getParent should return undefined if the key does not exist in hash', () => {
  const mockTreesByKey = {};
  mockTreesByKey['parentPkg'] = { };

  const res = ls.getParent('parentPkg#childPkg', mockTreesByKey);
  expect(res.name).not.toBeDefined();
  expect(res.children).not.toBeDefined();
});

test('setFlags should set options for --depth', () => {
  const flags = ['--depth'];
  const commander = require('commander');
  ls.setFlags(commander);

  const commanderOptions = commander.options;
  const optsLen = commanderOptions.length;
  flags.map((flag) => {
    let currFlagExists = false;
    for (let i = 0; i < optsLen; i++) {
      if (commanderOptions[i].long === flag) {
        currFlagExists = true;
      }
    }
    expect(currFlagExists).toBeTruthy();
  });
});

test('setFlags should set options for --depth', () => {
  const flags = ['--foo', '--bar', '--baz'];
  const commander = require('commander');
  ls.setFlags(commander);
  
  const commanderOptions = commander.options;
  const optsLen = commanderOptions.length;
  flags.map((flag) => {
    let currFlagExists = false;
    for (let i = 0; i < optsLen; i++) {
      if (commanderOptions[i].long === flag) {
        currFlagExists = true;
      }
    }
    expect(currFlagExists).not.toBeTruthy();
  });
});

test('getReqDepth should return a number if valid', () => {
  expect(ls.getReqDepth('1')).toEqual(1); 
  expect(ls.getReqDepth('01')).toEqual(1); 
});

test('getReqDepth should return -1 if invalid', () => {
  expect(ls.getReqDepth('foo')).toEqual(-1); 
  expect(ls.getReqDepth('bar')).toEqual(-1); 
  expect(ls.getReqDepth('')).toEqual(-1);
});
