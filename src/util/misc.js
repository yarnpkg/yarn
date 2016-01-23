/* @flow */

export function removePrefix(pattern: string, prefix: string): string {
  if (pattern.indexOf(prefix) === 0) {
    pattern = pattern.slice(prefix.length);
  }

  return pattern;
}

export function removeSuffix(pattern: string, suffix: string): string {
  if (pattern.indexOf(suffix) === pattern.length - suffix.length) {
    return pattern.slice(0, -suffix.length);
  }

  return pattern;
}
