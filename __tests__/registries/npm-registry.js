/* @flow */

import NpmRegistry from '../../src/registries/npm-registry.js';
import {resolve} from 'path';
import homeDir from '../../src/util/user-home-dir.js';

describe('normalizeConfig', () => {
  beforeAll(() => {
    process.env.REPLACE = 'REPLACED';
  });

  afterAll(() => {
    delete process.env.REPLACE;
  });

  test('environment is replaced', () => {
    const normalized = NpmRegistry.normalizeConfig({username: '[${REPLACE}]'})['username'];
    expect(normalized).toEqual('[REPLACED]');
  });

  test("path normalization doesn't affect all options", () => {
    const normalized = NpmRegistry.normalizeConfig({username: 'foo'})['username'];
    expect(normalized).toEqual('foo');
  });

  test('resolve path to current directory', () => {
    const normalized = NpmRegistry.normalizeConfig({cafile: 'foo'})['cafile'];
    expect(normalized).toEqual(resolve(process.cwd(), 'foo'));
  });

  test('resolve path to home directory', () => {
    const normalized = NpmRegistry.normalizeConfig({cafile: '~/foo'})['cafile'];
    expect(normalized).toEqual(resolve(homeDir, 'foo'));
  });

  test('resolve keep path to rooted directory', () => {
    const rooted = process.platform === 'win32' ? 'C:\\foo' : '/foo';
    const normalized = NpmRegistry.normalizeConfig({cafile: rooted})['cafile'];
    expect(normalized).toEqual(rooted);
  });
});
