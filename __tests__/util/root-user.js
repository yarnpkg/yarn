/* @flow */

import {isRootUser, isFakeRoot} from '../../src/util/root-user.js';

test('isRootUser', () => {
  expect(isRootUser(null)).toBe(false);
  expect(isRootUser(1001)).toBe(false);
  expect(isRootUser(0)).toBe(true);
});

test('isFakeRoot', () => {
  delete process.env.FAKEROOTKEY;

  expect(isFakeRoot()).toBe(false);

  process.env.FAKEROOTKEY = '15574641';
  expect(isFakeRoot()).toBe(true);

  delete process.env.FAKEROOTKEY;
});
