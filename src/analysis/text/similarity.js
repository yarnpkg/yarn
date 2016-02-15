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

let invariant = require("invariant");

type Char = number | string;

type LengthObject = string | Array<Char> | {
  length: number,
  [key: number]: Char
};

const LEVEN_MAX = 200;

function shortCircuit(a: LengthObject, b: LengthObject): ?number {
  if (!a.length && !b.length) {
    return 1;
  }

  if (!a.length || !b.length) {
    return 0;
  }
}

/**
 * Use Damerau–Levenshtein when the input text is small enough, otherwise just compare the
 * lines that each text has in common.
 */

export default function (a: LengthObject, b: LengthObject): number {
  let short = shortCircuit(a, b);
  if (short != null) return short;

  if (a.length <= LEVEN_MAX && b.length <= LEVEN_MAX) {
    return leven(a, b);
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

export function lines(a: string, b: string): number {
  let short = shortCircuit(a, b);
  if (short != null) return short;

  let aLines = a.split("\n");
  let bLines = b.split("\n");

  let commonLines = 0;

  for (let line of aLines) {
    if (bLines.indexOf(line) >= 0) {
      commonLines++;
    }
  }

  return commonLines / aLines.length;
}

/**
 * Implementation of the optimal string alignment distance algorithm.
 *
 * Calculate the distance between to input values by counting the minimum number of
 * operations needed to transform one into the other.
 *
 * https://en.wikipedia.org/wiki/Levenshtein_distance
 */

export function leven(a: LengthObject, b: LengthObject): number {
  let short = shortCircuit(a, b);
  if (short != null) return short;

  let steps;
  let tmp;
  let tmp2;
  let arr = [];

  let i = 0;
  while (i < a.length) {
    arr[i] = ++i;
  }

  let j = 0;
  while (j < b.length) {
    let bChar = b[j];
    tmp = j++;
    steps = j;

    for (let i = 0; i < a.length; i++) {
      tmp2 = bChar === a[i] ? tmp : tmp + 1;
      tmp = arr[i];
      steps = arr[i] = tmp > steps ? tmp2 > steps ? steps + 1 : tmp2 : tmp2 > tmp ? tmp + 1 : tmp2;
    }
  }

  invariant(typeof steps === "number", "Steps isn't a number");
  let relative   = steps / Math.max(a.length, b.length);
  let similarity = 1 - relative;
  return similarity;
}
