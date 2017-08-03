/* @flow */

import * as misc from '../../src/util/misc.js';

test('sortAlpha', () => {
  expect(
    ['foo@6.x', 'foo@^6.5.0', 'foo@~6.8.x', 'foo@^6.7.0', 'foo@~6.8.0', 'foo@^6.8.0', 'foo@6.8.0'].sort(misc.sortAlpha),
  ).toEqual(['foo@6.8.0', 'foo@6.x', 'foo@^6.5.0', 'foo@^6.7.0', 'foo@^6.8.0', 'foo@~6.8.0', 'foo@~6.8.x']);
});
