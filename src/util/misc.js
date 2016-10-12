/* @flow */

export function sortAlpha(a: string, b: string): number {
  // sort alphabetically
  return a.toLowerCase().localeCompare(b.toLowerCase());
}

export function entries<T>(obj: ?{ [key: string]: T }): Array<[string, T]> {
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

export function stringify(obj: Object): string {
  return JSON.stringify(obj, null, '  ');
}
