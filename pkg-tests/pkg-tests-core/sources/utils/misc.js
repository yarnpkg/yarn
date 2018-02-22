const {Minimatch} = require(`minimatch`);
const path = require(`path`);

exports.stringPatternMatch = function stringPatternMatch(string, patterns, {matchBase = false, dot = true} = {}) {
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

exports.filePatternMatch = function filePatternMatch(filePath, patterns, {matchBase = true, dot = true} = {}) {
  return exports.stringPatternMatch(path.resolve(`/`, filePath), patterns, {matchBase, dot});
};
