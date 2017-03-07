/* @flow */

import {isRootUser} from '../../src/util/root-user.js';

test('isRootUser', () => {
  expect(isRootUser(null)).toBe(false);
  expect(isRootUser(1001)).toBe(false);
  expect(isRootUser(0)).toBe(true);
});
