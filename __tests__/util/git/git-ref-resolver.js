/* @flow */

import Config from '../../../src/config.js';
import type {ResolvedSha, GitRefResolvingInterface, GitRefs} from '../../../src/util/git/git-ref-resolver.js';
import {resolveVersion, isCommitSha, parseRefs} from '../../../src/util/git/git-ref-resolver.js';

class GitMock implements GitRefResolvingInterface {
  resolveDefaultBranch(): Promise<ResolvedSha> {
    return Promise.resolve({sha: '8a41a314e23dc566a6b7e73c757a10d13e3320cf', ref: 'refs/heads/main'});
  }
  resolveCommit(sha: string): Promise<?ResolvedSha> {
    if (sha.startsWith('003ae60')) {
      return Promise.resolve({sha: '003ae6063f23a4184736610361f14438a3257c83', ref: undefined});
    }
    return Promise.resolve(null);
  }
}

test('resolveVersion', async () => {
  const config = await Config.create();

  const refs: GitRefs = new Map();
  refs.set('refs/heads/1.1', 'eaa56cb34863810060abbec2d755ba51508afedc');
  refs.set('refs/heads/3.3', '4cff93aa6e8270c3bec988af464d28a164bc3cb2');
  refs.set('refs/heads/v3.3.0', '06910374874035a3388c42a6f6403b2b785e9993');
  refs.set('refs/heads/main', '8a41a314e23dc566a6b7e73c757a10d13e3320cf');
  refs.set('refs/heads/both', '106c28537be070b98ca1effaef6a2bf6414e1e49');
  refs.set('refs/tags/v1.1.0', '37d5ed001dc4402d5446911c4e1cb589449e7d8d');
  refs.set('refs/tags/v2.2.0', 'e88209b9513544a22fc3f8660e3d829281dc2c9f');
  refs.set('refs/tags/both', 'f0dbab0a4345a64f544af37e24fc8187176936a4');
  refs.set('refs/pull/100/head', '6e97e0159f10c275f227d0f067d99f2a97331cef');
  const emptyRefs: GitRefs = new Map();
  const git = new GitMock();

  const resolve = version => resolveVersion({config, version, refs, git});

  expect(await resolve('')).toEqual({
    sha: '8a41a314e23dc566a6b7e73c757a10d13e3320cf',
    ref: 'refs/heads/main',
  });
  expect(await resolve('003ae6063f23a4184736610361f14438a3257c83')).toEqual({
    sha: '003ae6063f23a4184736610361f14438a3257c83',
    ref: undefined,
  });
  expect(await resolve('003ae60')).toEqual({
    sha: '003ae6063f23a4184736610361f14438a3257c83',
    ref: undefined,
  });
  // Test uppercase
  expect(await resolve('003AE60')).toEqual({
    sha: '003ae6063f23a4184736610361f14438a3257c83',
    ref: undefined,
  });
  expect(await resolve('4cff93aa6e8270c3bec988af464d28a164bc3cb2')).toEqual({
    sha: '4cff93aa6e8270c3bec988af464d28a164bc3cb2',
    ref: 'refs/heads/3.3',
  });
  expect(await resolve('4cff93a')).toEqual({
    sha: '4cff93aa6e8270c3bec988af464d28a164bc3cb2',
    ref: 'refs/heads/3.3',
  });
  expect(await resolve('main')).toEqual({
    sha: '8a41a314e23dc566a6b7e73c757a10d13e3320cf',
    ref: 'refs/heads/main',
  });
  expect(await resolve('1.1')).toEqual({
    sha: 'eaa56cb34863810060abbec2d755ba51508afedc',
    ref: 'refs/heads/1.1',
  });
  expect(await resolve('v1.1.0')).toEqual({
    sha: '37d5ed001dc4402d5446911c4e1cb589449e7d8d',
    ref: 'refs/tags/v1.1.0',
  });
  expect(await resolve('100/head')).toEqual({
    sha: '6e97e0159f10c275f227d0f067d99f2a97331cef',
    ref: 'refs/pull/100/head',
  });
  expect(await resolve('pull/100/head')).toEqual({
    sha: '6e97e0159f10c275f227d0f067d99f2a97331cef',
    ref: 'refs/pull/100/head',
  });
  // not-existing sha
  expect(await resolve('0123456')).toEqual(null);

  // Test tags precedence over branches
  expect(await resolve('both')).toEqual({
    sha: 'f0dbab0a4345a64f544af37e24fc8187176936a4',
    ref: 'refs/tags/both',
  });
  expect(await resolve('refs/heads/both')).toEqual({
    sha: '106c28537be070b98ca1effaef6a2bf6414e1e49',
    ref: 'refs/heads/both',
  });
  // Test no match
  expect(await resolve('unknown')).toEqual(null);

  // Test SemVer

  // prefix space to force semver
  expect(await resolve(' 1.1')).toEqual({
    sha: '37d5ed001dc4402d5446911c4e1cb589449e7d8d',
    ref: 'refs/tags/v1.1.0',
  });
  expect(await resolve('~1.1')).toEqual({
    sha: '37d5ed001dc4402d5446911c4e1cb589449e7d8d',
    ref: 'refs/tags/v1.1.0',
  });
  // test on tags first, should not match 3.3
  expect(await resolve('*')).toEqual({
    sha: 'e88209b9513544a22fc3f8660e3d829281dc2c9f',
    ref: 'refs/tags/v2.2.0',
  });
  // Test * without tags, use default branch
  expect(await resolveVersion({config, version: '*', refs: emptyRefs, git})).toEqual({
    sha: '8a41a314e23dc566a6b7e73c757a10d13e3320cf',
    ref: 'refs/heads/main',
  });
  expect(await resolve('^1.0')).toEqual({
    sha: '37d5ed001dc4402d5446911c4e1cb589449e7d8d',
    ref: 'refs/tags/v1.1.0',
  });
  expect(await resolve('semver:^1.0')).toEqual({
    sha: '37d5ed001dc4402d5446911c4e1cb589449e7d8d',
    ref: 'refs/tags/v1.1.0',
  });
  expect(await resolve('^3.0')).toEqual({
    sha: '06910374874035a3388c42a6f6403b2b785e9993',
    ref: 'refs/heads/v3.3.0',
  });
  expect(await resolve('semver:^3.0')).toEqual({
    sha: '06910374874035a3388c42a6f6403b2b785e9993',
    ref: 'refs/heads/v3.3.0',
  });
});

test('isCommitSha', () => {
  expect(isCommitSha('ca82a6dff817ec66f44312307202690a93763949')).toBeTruthy();
  expect(isCommitSha('abc12')).toBeTruthy();
  expect(isCommitSha('')).toBeFalsy();
  expect(isCommitSha('abc12_')).toBeFalsy();
  expect(isCommitSha('gccda')).toBeFalsy();
  expect(isCommitSha('abC12')).toBeFalsy();
});

test('parseRefs', () => {
  const parse = refs => {
    const refsAsObject = {};
    for (const [key, value] of parseRefs(refs).entries()) {
      refsAsObject[key] = value;
    }
    return refsAsObject;
  };

  expect(parse(`64b2c0cee9e829f73c5ad32b8cc8cb6f3bec65bb refs/tags/v4.2.2`)).toMatchObject({
    'refs/tags/v4.2.2': '64b2c0cee9e829f73c5ad32b8cc8cb6f3bec65bb',
  });

  expect(
    parse(`ebeb6eafceb61dd08441ffe086c77eb472842494  refs/tags/v0.21.0
70e76d174b0c7d001d2cd608a16c94498496e92d  refs/tags/v0.21.0^{}
de43f4a993d1e08cd930ee22ecb2bac727f53449  refs/tags/v0.21.0-pre`),
  ).toMatchObject({
    'refs/tags/v0.21.0': '70e76d174b0c7d001d2cd608a16c94498496e92d',
    'refs/tags/v0.21.0-pre': 'de43f4a993d1e08cd930ee22ecb2bac727f53449',
  });

  expect(
    parse(`ebeb6eafceb61dd08441ffe086c77eb472842494  refs/tags/tag
70e76d174b0c7d001d2cd608a16c94498496e92d refs/merge-requests/38/head`),
  ).toMatchObject({
    'refs/tags/tag': 'ebeb6eafceb61dd08441ffe086c77eb472842494',
  });

  expect(
    parse(`**********
This is a custom response header
  as described in: https://github.com/yarnpkg/yarn/issues/3325
**********

ebeb6eafceb61dd08441ffe086c77eb472842494  refs/tags/v0.21.0
70e76d174b0c7d001d2cd608a16c94498496e92d  refs/tags/v0.21.0^{}
de43f4a993d1e08cd930ee22ecb2bac727f53449  refs/tags/v0.21.0-pre`),
  ).toMatchObject({
    'refs/tags/v0.21.0': '70e76d174b0c7d001d2cd608a16c94498496e92d',
    'refs/tags/v0.21.0-pre': 'de43f4a993d1e08cd930ee22ecb2bac727f53449',
  });
});
