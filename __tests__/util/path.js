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

import {resolveWithHome} from '../../src/util/path.js';

describe('resolveWithHome', () => {
  describe('!win32', () => {
    beforeAll(() => {
      Object.defineProperty(process, 'platform', {configurable: true, value: 'notWin32'});
    });

    test('Paths with home are resolved', () => {
      expect(resolveWithHome('~/bar/baz/q')).toEqual('RESOLVED ["/home/foo","bar/baz/q"]');
    });
  });

  describe('win32', () => {
    beforeAll(() => {
      Object.defineProperty(process, 'platform', {configurable: true, value: 'win32'});
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
