/* @flow */

const {Minimatch} = require('minimatch');
const path = require('path');

exports.stringPatternMatch = function stringPatternMatch(
  string: string,
  patterns: Array<string>,
  {matchBase = false, dot = true}: {|matchBase?: boolean, dot?: boolean|} = {},
): boolean {
  const compiledPatterns = (Array.isArray(patterns) ? patterns : [patterns]).map(
    pattern => new Minimatch(pattern, {matchBase, dot}),
  );

  // If there's only negated patterns, we assume that everything should match by default
  let status = compiledPatterns.every(compiledPattern => compiledPattern.negated);

  for (const compiledPattern of compiledPatterns) {
    if (compiledPattern.negated) {
      if (!status) {
        continue;
      }

      status = compiledPattern.match(string) === false;
    } else {
      if (status) {
        continue;
      }

      status = compiledPattern.match(string) === true;
    }
  }

  return status;
};

exports.filePatternMatch = function filePatternMatch(
  filePath: string,
  patterns: Array<string>,
  {matchBase = true, dot = true}: {|matchBase?: boolean, dot?: boolean|} = {},
): boolean {
  return exports.stringPatternMatch(path.resolve('/', filePath), patterns, {matchBase, dot});
};
