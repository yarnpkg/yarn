/* @flow */

import {parse} from 'url';

import GitResolver from '../../../src/resolvers/exotics/git-resolver.js';

test('GitResolver transformUrl method is defined', () => {
  expect(GitResolver.transformUrl).toBeDefined();
});

test('GitResolver transformUrl does not affect normal urls', () => {

  const urls = [
    'git+https://github.com/npm-ml/ocaml.git#npm-4.02.3',
    'git+ssh://git@gitlab.com/user/repo.git',
    'git+ssh://git@github.com/user/repo.git',
    'git+ssh://username@private.url/sub/right-pad',
    'https://github.com/npm-ml/re',
    'https://github.com/npm-ml/ocaml.git#npm-4.02.3',
    'https://git@github.com/stevemao/left-pad.git',
    'https://bitbucket.org/hgarcia/node-bitbucket-api.git',
    'https://github.com/yarnpkg/yarn/releases/download/v0.18.1/yarn-v0.18.1.tar.gz',
    'https://github.com/babel/babel-loader.git#greenkeeper/cross-env-3.1.4',
    'package@git@bitbucket.org:team/repo.git',
  ];

  urls.forEach((url) => {
    expect(GitResolver.transformUrl(parse(url))).toBe(url);
  });

});

test('GitResolver transformUrl affect host colon separated urls', () => {

  const urls = [
    'git+ssh://username@private.url:sub/right-pad',
    'git+ssh://private.url:sub/right-pad',
    'https://private.url:sub/right-pad',
  ];

  urls.forEach((url) => {
    expect(GitResolver.transformUrl(parse(url))).toBe(url.replace(':sub', '/sub'));
  });

});
