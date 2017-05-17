/* @flow */

import {ignoreLinesToRegex} from '../../src/util/filter.js';

test('ignoreLinesToRegex', () => {
  expect(
    ignoreLinesToRegex([
      'a',
      'b ',
      ' c ',
      'd #',
      'e#',
      'f # ',
      'g# ',
      'h # foo',
      'i# foo',
      'j # foo #',
      'k # foo # #',
      '# l',
      '# m #',
      '# ',
      '#',
      '',
      '!',
      '!A',
      '! B',
      '! C ',
      '! D #',
      '! E # ',
      '! F # # ',
      '#! G',
    ]),
  ).toEqual([
    {base: '.', isNegation: false, pattern: 'a', regex: /^(?:a)$/i},
    {base: '.', isNegation: false, pattern: 'b ', regex: /^(?:b)$/i},
    {base: '.', isNegation: false, pattern: ' c ', regex: /^(?:c)$/i},
    {base: '.', isNegation: false, pattern: 'd #', regex: /^(?:d #)$/i},
    {base: '.', isNegation: false, pattern: 'e#', regex: /^(?:e#)$/i},
    {base: '.', isNegation: false, pattern: 'f # ', regex: /^(?:f #)$/i},
    {base: '.', isNegation: false, pattern: 'g# ', regex: /^(?:g#)$/i},
    {base: '.', isNegation: false, pattern: 'h # foo', regex: /^(?:h # foo)$/i},
    {base: '.', isNegation: false, pattern: 'i# foo', regex: /^(?:i# foo)$/i},
    {
      base: '.',
      isNegation: false,
      pattern: 'j # foo #',
      regex: /^(?:j # foo #)$/i,
    },
    {
      base: '.',
      isNegation: false,
      pattern: 'k # foo # #',
      regex: /^(?:k # foo # #)$/i,
    },
    {base: '.', isNegation: true, pattern: 'A', regex: /^(?:A)$/i},
    {base: '.', isNegation: true, pattern: ' B', regex: /^(?:B)$/i},
    {base: '.', isNegation: true, pattern: ' C ', regex: /^(?:C)$/i},
    {base: '.', isNegation: true, pattern: ' D #', regex: /^(?:D #)$/i},
    {base: '.', isNegation: true, pattern: ' E # ', regex: /^(?:E #)$/i},
    {base: '.', isNegation: true, pattern: ' F # # ', regex: /^(?:F # #)$/i},
  ]);
});
