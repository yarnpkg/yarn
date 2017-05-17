/* @flow */

import {fileDatesEqual} from '../../src/util/fs.js';

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
  });
});
