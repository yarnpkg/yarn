/* @flow */

import type {Reporter} from '../reporters/index.js';

export default function(from: string, to: string, reporter: Reporter): string {
  const parts = to.split('.');
  const fromParts = from.split('.');

  const splitIndex = parts.findIndex((part, i) => part !== fromParts[i]);
  if (splitIndex === -1) {
    return from;
  }

  const colorized = reporter.format.green(parts.slice(splitIndex).join('.'));
  return parts.slice(0, splitIndex).concat(colorized).join('.');
}
