/* @flow */

const _camelCase = require('camelcase');

export function sortAlpha(a: string, b: string): number {
  // sort alphabetically in a deterministic way
  const shortLen = Math.min(a.length, b.length);
  for (let i = 0; i < shortLen; i++) {
    const aChar = a.charCodeAt(i);
    const bChar = b.charCodeAt(i);
    if (aChar !== bChar) {
      return aChar - bChar;
    }
  }
  return a.length - b.length;
}

export function sortOptionsByFlags(a: Object, b: Object): number {
  const aOpt = a.flags.replace(/-/g, '');
  const bOpt = b.flags.replace(/-/g, '');
  return sortAlpha(aOpt, bOpt);
}

export function entries<T>(obj: ?{[key: string]: T}): Array<[string, T]> {
  const entries = [];
  if (obj) {
    for (const key in obj) {
      entries.push([key, obj[key]]);
    }
  }
  return entries;
}

export function removePrefix(pattern: string, prefix: string): string {
  if (pattern.startsWith(prefix)) {
    pattern = pattern.slice(prefix.length);
  }

  return pattern;
}

export function removeSuffix(pattern: string, suffix: string): string {
  if (pattern.endsWith(suffix)) {
    return pattern.slice(0, -suffix.length);
  }

  return pattern;
}

export function addSuffix(pattern: string, suffix: string): string {
  if (!pattern.endsWith(suffix)) {
    return pattern + suffix;
  }

  return pattern;
}

export function hyphenate(str: string): string {
  return str.replace(/[A-Z]/g, match => {
    return '-' + match.charAt(0).toLowerCase();
  });
}

export function camelCase(str: string): ?string {
  if (/[A-Z]/.test(str)) {
    return null;
  } else {
    return _camelCase(str);
  }
}

export function compareSortedArrays<T>(array1: Array<T>, array2: Array<T>): boolean {
  if (array1.length !== array2.length) {
    return false;
  }
  for (let i = 0, len = array1.length; i < len; i++) {
    if (array1[i] !== array2[i]) {
      return false;
    }
  }
  return true;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
