/* @flow */

jest.mock('../../src/util/user-home-dir.js', () => ({
  default: '/home/foo',
}));

import {expandPath} from '../../src/util/path.js';

describe('fileDatesEqual', () => {
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
