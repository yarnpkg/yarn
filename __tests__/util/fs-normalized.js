/* @flow */

import {fileDatesEqual} from '../../src/util/fs-normalized.js';

describe('fileDatesEqual', () => {
  describe('!win32', () => {
    beforeAll(() => {
      Object.defineProperty(process, 'platform', {configurable: true, value: 'notWin32'});
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
      Object.defineProperty(process, 'platform', {configurable: true, value: 'win32'});
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
