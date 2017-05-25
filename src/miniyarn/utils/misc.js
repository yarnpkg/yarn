import { Minimatch } from 'minimatch';
import Path          from 'path';

export function isGithubReference(string) {

    return string.match(/^[\w]+\/[\w]+(#|$)/);

}

export function isGitReference(string) {

    return string.match(/^((git|ssh|http(s)?)|(git@[\w\.]+))(:(\/\/)?)([\w\.@\:\/\-~]+)(\.git)(\/)?(#|$)/);

}

export function stringPatternMatch(string, patterns, { matchBase = false, dot = true } = {}) {

    let compiledPatterns = (Array.isArray(patterns) ? patterns : [ patterns ])
        .map(pattern => new Minimatch(pattern, { matchBase, dot }));

    // If there's only negated patterns, we assume that everything should match by default
    let status = compiledPatterns.every(compiledPattern => compiledPattern.negated);

    for (let compiledPattern of compiledPatterns) {

        if (compiledPattern.negated) {

            if (!status)
                continue;

            status = compiledPattern.match(string) === false;

        } else {

            if (status)
                continue;

            status = compiledPattern.match(string) === true;

        }

    }

    return status;

}

export function filePatternMatch(path, patterns, { matchBase = true, dot = true } = {}) {

    return stringPatternMatch(Path.resolve(`/`, path), patterns, { matchBase, dot });

}

export function debugEvents(obj) {

    let emit = obj.emit;

    obj.emit = (... args) => {
        console.log(... args);
        return emit.apply(obj, args);
    };

}
