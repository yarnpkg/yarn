/* @flow */
/**
 * Explode and normalize a pattern into its name and range.
 */

export function normalizePattern(
  pattern: string,
): {
  hasVersion: boolean,
  name: string,
  range: string,
} {
  let hasVersion = false;
  let range = 'latest';
  let name = pattern;

  // if we're a scope then remove the @ and add it back later
  let isScoped = false;
  if (name[0] === '@') {
    isScoped = true;
    name = name.slice(1);
  }

  // take first part as the name
  const parts = name.split('@');
  if (parts.length > 1) {
    name = parts.shift();
    range = parts.join('@');

    if (range) {
      hasVersion = true;
    } else {
      range = '*';
    }
  }

  // add back @ scope suffix
  if (isScoped) {
    name = `@${name}`;
  }

  return {name, range, hasVersion};
}
