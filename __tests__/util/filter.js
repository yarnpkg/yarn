/* @flow */

import {ignoreLinesToRegex, filterOverridenGitignores} from '../../src/util/filter.js';

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

test('filterOverridenGitignores', () => {
  expect(
    filterOverridenGitignores([
      {relative: '.gitignore', basename: '.gitignore', absolute: '/home/user/p/.gitignore', mtime: 0},
      {relative: '.npmignore', basename: '.npmignore', absolute: '/home/user/p/.npmignore', mtime: 0},
      {relative: 'docs', basename: 'lib', absolute: '/home/user/p/docs', mtime: 0},
      {relative: 'docs/file.txt', basename: 'file.txt', absolute: '/home/user/p/docs/file.txt', mtime: 0},
      {relative: 'index.js', basename: 'index.js', absolute: '/home/user/p/index.js', mtime: 0},
      {relative: 'lib', basename: 'lib', absolute: '/home/user/p/lib', mtime: 0},
      {relative: 'lib/.gitignore', basename: '.gitignore', absolute: '/home/user/p/lib/.gitignore', mtime: 0},
      {relative: 'lib/index.js', basename: 'index.js', absolute: '/home/user/p/lib/index.js', mtime: 0},
      {relative: 'README.md', basename: 'README.md', absolute: '/home/user/p/README.md', mtime: 0},
      {relative: 'src', basename: 'src', absolute: '/home/user/p/src', mtime: 0},
      {relative: 'src/.yarnignore', basename: '.yarnignore', absolute: '/home/user/p/src/.yarnignore', mtime: 0},
      {relative: 'src/app.js', basename: 'app.js', absolute: '/home/user/p/src/app.js', mtime: 0},
    ]),
  ).toEqual([
    {relative: '.npmignore', basename: '.npmignore', absolute: '/home/user/p/.npmignore', mtime: 0},
    {relative: 'lib/.gitignore', basename: '.gitignore', absolute: '/home/user/p/lib/.gitignore', mtime: 0},
    {relative: 'src/.yarnignore', basename: '.yarnignore', absolute: '/home/user/p/src/.yarnignore', mtime: 0},
  ]);
});
