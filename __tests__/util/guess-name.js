/* @flow */

import guessName from '../../src/util/guess-name';

const examples = [
  'http://github.com/foo-bar/awesome-name',
  'http://github.com/foo-bar/awesome-name.git',
  'http://awesome.com/awesome-name.git',
  'http://awesome.com/awesome-name.git?foo/bar#fiz/fuz',
  'https://github.com/hashicorp/awesome-name/archive/v0.5.5.tar.gz',
  'https://gitlab.com/foo/awesome-name/repository/archive.tar.gz?ref=3.11.0',
  'https://gitlab.com/foo/awesome-name/repository/archive.tar.bz2?ref=3.11.0',
  'https://gitlab.com/foo/awesome-name/repository/archive.tar?ref=3.11.0',
  'https://gitlab.com/foo/awesome-name/repository/archive.zip?ref=3.11.0',
  'git@gitlab.com:yolo/awesome-name.git',
  'https://gitlab.com/yolo/awesome-name.git',
  'https://asesome.com/yolo/awesome-name-0.2.3.tar.gz',
  '/foo/bar/awesome-name',
  './foo/bar/awesome-name',
  '../foo/bar/awesome-name',
  'file:../foo/bar/awesome-name',
  'file:../foo/bar/awesome-name.tar.gz',
  'awesome-name',
  'awesome-name.tar.gz',
];

describe('guessName', () => {
  for (const source of examples) {
    it(`guess name of ${source}`, () => {
      expect(guessName(source)).toBe('awesome-name');
    });
  }
});
