/* @flow */

import type {WalkFiles} from './fs.js';
import {removeSuffix} from './misc.js';

const minimatch = require('minimatch');
const path = require('path');

const WHITESPACE_RE = /^\s+$/;

export type IgnoreFilter = {
  base: string,
  isNegation: boolean,
  regex: RegExp,
};

export function sortFilter(
  files: WalkFiles,
  filters: Array<IgnoreFilter>,
  keepFiles: Set<string> = new Set(),
  possibleKeepFiles: Set<string> = new Set(),
  ignoreFiles: Set<string> = new Set(),
): {
  keepFiles: Set<string>,
  ignoreFiles: Set<string>,
} {
  for (const file of files) {
    let keep = false;

    // always keep a file if a ! pattern matches it
    for (const filter of filters) {
      if (filter.isNegation && matchesFilter(filter, file.basename, file.relative)) {
        keep = true;
        break;
      }
    }

    //
    if (keep) {
      keepFiles.add(file.relative);
      continue;
    }

    // otherwise don't keep it if a pattern matches it
    keep = true;
    for (const filter of filters) {
      if (!filter.isNegation && matchesFilter(filter, file.basename, file.relative)) {
        keep = false;
        break;
      }
    }

    if (keep) {
      possibleKeepFiles.add(file.relative);
    } else {
      ignoreFiles.add(file.relative);
    }
  }

  // exclude file
  for (const file of possibleKeepFiles) {
    const parts = path.dirname(file).split(path.sep);

    while (parts.length) {
      const folder = parts.join(path.sep);
      if (ignoreFiles.has(folder)) {
        ignoreFiles.add(file);
        break;
      }
      parts.pop();
    }
  }

  //
  for (const file of possibleKeepFiles) {
    if (!ignoreFiles.has(file)) {
      keepFiles.add(file);
    }
  }

  //
  for (const file of keepFiles) {
    const parts = path.dirname(file).split(path.sep);

    while (parts.length) {
      // deregister this folder from being ignored, any files inside
      // will still be marked as ignored
      ignoreFiles.delete(parts.join(path.sep));
      parts.pop();
    }
  }

  return {keepFiles, ignoreFiles};
}

export function matchesFilter(filter: IgnoreFilter, basename: string, loc: string): boolean {
  if (filter.base && filter.base !== '.') {
    loc = path.relative(filter.base, loc);
  }
  return filter.regex.test(loc) ||
         filter.regex.test(`/${loc}`) ||
         filter.regex.test(basename);
}

export function ignoreLinesToRegex(lines: Array<string>, base: string = '.'): Array<IgnoreFilter> {
  return lines
    // create regex
    .map((line): ?IgnoreFilter => {
      // remove empty lines, comments, etc
      if (line === '' || line === '!' || line[0] === '#' || WHITESPACE_RE.test(line)) {
        return null;
      }

      let pattern = line;
      let isNegation = false;

      // hide the fact that it's a negation from minimatch since we'll handle this specifally
      // ourselves
      if (pattern[0] === '!') {
        isNegation = true;
        pattern = pattern.slice(1);
      }

      // remove trailing slash
      pattern = removeSuffix(pattern, '/');

      const regex: ?RegExp = minimatch.makeRe(pattern, {nocase: true});

      if (regex) {
        return {
          base,
          isNegation,
          regex,
        };
      } else {
        return null;
      }
    })

    .filter(Boolean);
}
