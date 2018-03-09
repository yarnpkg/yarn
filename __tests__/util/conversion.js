/* @flow */

import {boolify, boolifyWithDefault} from '../../src/util/conversion.js';

describe('boolify', () => {
  test('should recognize "true" values', () => {
    expect(boolify('1')).toBe(true);
    expect(boolify(1)).toBe(true);
    expect(boolify('true')).toBe(true);
    expect(boolify(true)).toBe(true);
  });

  test('should recognize "false" values', () => {
    expect(boolify('0')).toBe(false);
    expect(boolify(0)).toBe(false);
    expect(boolify('false')).toBe(false);
    expect(boolify(false)).toBe(false);
  });

  // Not sure if that's really a requirement, but it's how it currently works
  test('should treat unrecognized values as "true"', () => {
    expect(boolify('randomstringdfkjh')).toBe(true);
  });
});

describe('boolifyWithDefault', () => {
  test('should return the default for empty values', () => {
    expect(boolifyWithDefault(undefined, true)).toBe(true);
    expect(boolifyWithDefault(undefined, false)).toBe(false);
    expect(boolifyWithDefault(null, true)).toBe(true);
    expect(boolifyWithDefault(null, false)).toBe(false);
    expect(boolifyWithDefault('', true)).toBe(true);
    expect(boolifyWithDefault('', false)).toBe(false);
  });

  test('should be consistent with boolify() for non-empty values', () => {
    for (const value of [1, '1', true, 'true', 0, '0', false, 'false', 'randomstringlkjsaljdja', 649815]) {
      for (const defaultResult of [true, false]) {
        expect(boolifyWithDefault(value, defaultResult)).toBe(boolify(value));
      }
    }
  });
});
