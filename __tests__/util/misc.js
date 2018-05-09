/* @flow */

import {sortAlpha, humanizeBytes} from '../../src/util/misc.js';

test('sortAlpha', () => {
  expect(
    ['foo@6.x', 'foo@^6.5.0', 'foo@~6.8.x', 'foo@^6.7.0', 'foo@~6.8.0', 'foo@^6.8.0', 'foo@6.8.0'].sort(sortAlpha),
  ).toEqual(['foo@6.8.0', 'foo@6.x', 'foo@^6.5.0', 'foo@^6.7.0', 'foo@^6.8.0', 'foo@~6.8.0', 'foo@~6.8.x']);
});

const getLastChars = (str: string, num: number): string => {
  const chars = [];

  for (let i = 0; i < num; i++) {
    chars.unshift(str[str.length - (i + 1)]);
  }

  return chars.join('');
};

describe('humanizeBytes', () => {
  test('handles 0', () => {
    expect(humanizeBytes(0)).toEqual('0B');
  });

  test('converts a buffer length to binary and outputs correct string', () => {
    const bufferSize = 2000;
    const buffer = Buffer.alloc(bufferSize);
    const bufferLen = buffer.length;
    expect(humanizeBytes(bufferLen)).toEqual('1.95KB');
  });

  test('appends the correct unit', () => {
    const zero = 0;
    const tenThousand = 10000;
    const oneMillion = 1000000;
    const oneHundredMillion = 100000000;

    expect(getLastChars(humanizeBytes(zero), 1)).toEqual('B');
    expect(getLastChars(humanizeBytes(tenThousand), 2)).toEqual('KB');
    expect(getLastChars(humanizeBytes(oneMillion), 2)).toEqual('KB');
    expect(getLastChars(humanizeBytes(oneHundredMillion), 2)).toEqual('MB');
  });
});
