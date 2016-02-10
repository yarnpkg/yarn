/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

type Char = number | string;

type LengthObject = string | Array<Char> | {
  length: number,
  [key: number]: Char
};

const LEVEN_MAX = 200;

/**
 * Use Damerau–Levenshtein when the input text is small enough, otherwise just compare the
 * lines that each text has in common.
 */

export default function (a: LengthObject, b: LengthObject): number {
  if (!a.length && !b.length) {
    return 1;
  }

  if (!a.length || !b.length) {
    return 0;
  }

  if (a.length <= LEVEN_MAX && b.length <= LEVEN_MAX) {
    return damLeven(a, b);
  } else {
    return lines(String(a), String(b));
  }
}

/**
 * Fast way to compare the similarity of a large body of text that's delimetered by newlines.
 *
 * Dunno if there's a name for this algorithm but if there's not I want it called the
 * "Sebastian McKenzie supreme text comparison analyser thingo or something".
 */

export function lines(a: string, b: string) {
  let aLines = a.split("\n");
  let bLines = a.split("\n");

  let commonLines = 0;

  for (let line of aLines) {
    if (bLines.indexOf(a) >= 0) {
      commonLines++;
    }
  }

  return commonLines / aLines.length;
}

/**
 * Implementation of the Damerau–Levenshtein optimal string alignment distance algorithm.
 *
 * Calculate the distance between to input values by counting the minimum number of
 * operations needed to transform one into the other.
 *
 * https://en.wikipedia.org/wiki/Damerau%E2%80%93Levenshtein_distance
 */

export function damLeven(a: LengthObject, b: LengthObject): number {
  // build up matrix
  let matrix: Array<Array<number>> = new Array(a.length);
  for (let i = 0; i < a.length + 1; i++) {
    matrix[i] = new Array(b.length);
    matrix[i][0] = i;
  }
  for (let j = 0; j < b.length + 1; j++) {
    matrix[0][j] = j;
  }

  // perform comparisons
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      let cost = a[i] === b[j] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j    ] + 1,   // deletion
        matrix[i    ][j - 1] + 1,   // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );

      if (i > 1 && j > 1 && a[i] === b[j - 1] && a[i - 1] === b[j]) {
        // transposition
        matrix[i][j] = Math.min(
          matrix[i][j],
          matrix[i - 2][j - 2] + cost
        );
      }
    }
  }

  let steps      = matrix[a.length][b.length];
  let relative   = steps / Math.max(a.length, b.length);

  let similarity = 1 - relative;
  return similarity;
}
