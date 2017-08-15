/* @flow */

import {getRcArgs} from '../src/rc.js';
import * as path from 'path';

const fixturesLoc = path.join(__dirname, 'fixtures', 'rc');

test('resolve .yarnrc args and use --cwd if present', () => {
  const args = getRcArgs('install', ['--cwd', path.join(fixturesLoc, 'empty')]);
  expect(args.includes('--foo')).toBe(true);
});

test('resolve .yarnrc args and use process.cwd() if no --cwd present', () => {
  const cwd = process.cwd();
  process.chdir(path.join(fixturesLoc, 'empty'));

  try {
    const args = getRcArgs('install', []);
    expect(args.includes('--foo')).toBe(true);
  } finally {
    process.chdir(cwd);
  }
});

test('resolve .yarnrc args and handle --cwd arg inside .yarnrc', () => {
  const args = getRcArgs('install', ['--cwd', path.join(fixturesLoc, 'inside')]);
  expect(args.includes('--foo')).toBe(true);
});

test('resolve .yarnrc args and bail out of recursive --cwd args inside of .yarnrc', () => {
  expect(() => {
    getRcArgs('install', ['--cwd', path.join(fixturesLoc, 'recursive')]);
  }).toThrowError();
});

test('resolve .yarnrc args and adds command name prefixed arguments', () => {
  const args = getRcArgs('add', ['--cwd', path.join(fixturesLoc, 'prefixed')]);
  expect(args.includes('--foo')).toBe(true);
  expect(args.includes('--bar')).toBe(false);
});
