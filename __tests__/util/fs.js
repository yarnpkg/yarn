/* @flow */

jest.mock('../../src/util/user-home-dir.js', () => ({
  default: '/home/foo',
}));

import {fileDatesEqual, expandPath} from '../../src/util/fs.js';

describe('fileDatesEqual', () => {
  const realPlatform = process.platform;

  describe('!win32', () => {
    beforeAll(() => {
      process.platform = 'notWin32';
    });

    afterAll(() => {
      process.platform = realPlatform;
    });

    test('Same dates equal', () => {
      expect(fileDatesEqual(new Date(1491393798834), new Date(1491393798834))).toBeTruthy();
      expect(fileDatesEqual(new Date(1491393798000), new Date(1491393798000))).toBeTruthy();
    });

    test('Different dates differ', () => {
      expect(fileDatesEqual(new Date(1491393798834), new Date(1491393798835))).toBeFalsy();
      expect(fileDatesEqual(new Date(1491393700834), new Date(1491393798834))).toBeFalsy();
      expect(fileDatesEqual(new Date(1491393798000), new Date(1491393798835))).toBeFalsy();
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

    test('Same dates equal', () => {
      expect(fileDatesEqual(new Date(1491393798834), new Date(1491393798834))).toBeTruthy();
    });

    test('Different dates differ', () => {
      expect(fileDatesEqual(new Date(1491393798834), new Date(1491393798835))).toBeTruthy();
      expect(fileDatesEqual(new Date(1491393798834), new Date(1491393798836))).toBeFalsy();
      expect(fileDatesEqual(new Date(1491393700834), new Date(1491393798834))).toBeFalsy();
    });

    test('Milliseconds are ignored when one date has zero milliseconds', () => {
      expect(fileDatesEqual(new Date(1491393798000), new Date(1491393798835))).toBeTruthy();
      expect(fileDatesEqual(new Date(1491393798834), new Date(1491393798000))).toBeTruthy();
    });

    test('Paths never get expanded', () => {
      expect(expandPath('~/bar/baz/q')).toEqual('~/bar/baz/q');
      expect(expandPath('  ~/bar/baz')).toEqual('  ~/bar/baz');
      expect(expandPath('./~/bar/baz')).toEqual('./~/bar/baz');
      expect(expandPath('~/~/bar/baz')).toEqual('~/~/bar/baz');
    });
  });
});
