/* @flow */

jest.mock('../../src/util/user-home-dir.js', () => ({
  default: '/home/foo',
}));

jest.mock('path', () => {
  const path = jest.genMockFromModule('fs');
  path.resolve = function(): string {
    return 'RESOLVED ' + JSON.stringify(Array.prototype.slice.call(arguments));
  };
  return path;
});

import {expandPath, resolveWithHome} from '../../src/util/path.js';

describe('expandPath', () => {
  const realPlatform = process.platform;

  describe('!win32', () => {
    beforeAll(() => {
      process.platform = 'notWin32';
    });

    afterAll(() => {
      process.platform = realPlatform;
    });

    test('Paths get expanded', () => {
      expect(expandPath('~/bar/baz/q')).toEqual('/home/foo/bar/baz/q');
      expect(expandPath('  ~/bar/baz')).toEqual('/home/foo/bar/baz');
      expect(expandPath('./~/bar/baz')).toEqual('./~/bar/baz');
      expect(expandPath('~/~/bar/baz')).toEqual('/home/foo/~/bar/baz');
    });
  });

  describe('win32', () => {
    beforeAll(() => {
      process.platform = 'win32';
    });

    afterAll(() => {
      process.platform = realPlatform;
    });

    test('Paths never get expanded', () => {
      expect(expandPath('~/bar/baz/q')).toEqual('~/bar/baz/q');
      expect(expandPath('  ~/bar/baz')).toEqual('  ~/bar/baz');
      expect(expandPath('./~/bar/baz')).toEqual('./~/bar/baz');
      expect(expandPath('~/~/bar/baz')).toEqual('~/~/bar/baz');
    });
  });
});

describe('resolveWithHome', () => {
  const realPlatform = process.platform;

  describe('!win32', () => {
    beforeAll(() => {
      process.platform = 'notWin32';
    });

    afterAll(() => {
      process.platform = realPlatform;
    });

    test('Paths with home are resolved', () => {
      expect(resolveWithHome('~/bar/baz/q')).toEqual('RESOLVED ["/home/foo","bar/baz/q"]');
    });
  });

  describe('win32', () => {
    beforeAll(() => {
      process.platform = 'win32';
    });

    afterAll(() => {
      process.platform = realPlatform;
    });

    test('Paths with home are resolved', () => {
      expect(resolveWithHome('~/bar/baz/q')).toEqual('RESOLVED ["/home/foo","bar/baz/q"]');
      expect(resolveWithHome('~\\bar\\baz\\q')).toEqual('RESOLVED ["/home/foo","bar\\\\baz\\\\q"]');
    });
  });

  test('Paths without home are resolved', () => {
    expect(resolveWithHome('bar/baz/q')).toEqual('RESOLVED ["bar/baz/q"]');
    expect(resolveWithHome('/bar/baz/q')).toEqual('RESOLVED ["/bar/baz/q"]');
  });
});
