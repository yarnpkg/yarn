/* @flow */

import {explodeHashedUrl} from '../../src/util/version.js';

test('explodeHashedUrl', () => {
  expect(explodeHashedUrl('https://github.com/yarnpkg/yarn.git#v1.2.3')).toEqual({
    url: 'https://github.com/yarnpkg/yarn.git',
    hash: 'v1.2.3',
  });

  expect(explodeHashedUrl('https://github.com/yarnpkg/yarn.git')).toEqual({
    url: 'https://github.com/yarnpkg/yarn.git',
    hash: '',
  });

  expect(explodeHashedUrl('https://github.com/yarnpkg/yarn.git#')).toEqual({
    url: 'https://github.com/yarnpkg/yarn.git',
    hash: '',
  });

  expect(explodeHashedUrl('https://github.com/yarnpkg/yarn.git#v1.2.007#secret-version')).toEqual({
    url: 'https://github.com/yarnpkg/yarn.git',
    hash: 'v1.2.007#secret-version',
  });
});
