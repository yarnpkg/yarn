/* @flow */

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
