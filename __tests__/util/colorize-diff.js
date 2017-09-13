/* @flow */

import colorizeDiff from '../../src/util/colorize-diff';
import {Reporter} from '../../src/reporters';

let from;
let to;
let reporter;

describe('colorizeDiff', () => {
  beforeAll(() => {
    reporter = new Reporter();
  });

  describe('when `from` and `to` versions are identical', () => {
    beforeEach(() => {
      from = '1.0.0';
      to = '1.0.0';
    });

    it('returns from/to value', () => {
      expect(colorizeDiff(from, to, reporter)).toEqual(from);
    });
  });
});
