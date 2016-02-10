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

let diff = require("diff");

type Components = Array<{
  added: boolean,
  removed: boolean,
  value: string
}>;

type DiffLineOptions = {
  ignoreWhitespace?: boolean,
  newlineIsToken?: boolean
};

export let diffChars: (a: string, b: string) => Components = diff.diffChars;
export let diffLines: (a: string, b: string, opts?: DiffLineOptions) => Components = diff.diffLines;
