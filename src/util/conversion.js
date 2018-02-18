/* @flow */

const FALSY_STRINGS = new Set(['0', 'false']);

export function boolify(val: string | number | boolean): boolean {
  return !FALSY_STRINGS.has(val.toString().toLowerCase());
}

export function boolifyWithDefault(val: ?(string | number | boolean), defaultResult: boolean): boolean {
  return val === '' || val === null || val === undefined ? defaultResult : boolify(val);
}
