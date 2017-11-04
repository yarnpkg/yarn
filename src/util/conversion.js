/* @flow */

export function boolify(val: string | number | boolean): boolean {
  const strVal = val.toString().toLowerCase();
  return strVal !== 'false' && strVal !== '0';
}

export function boolifyWithDefault(val: ?(string | number | boolean), defaultResult: boolean): boolean {
  if (val === undefined || val === null || val === '') {
    return defaultResult;
  } else {
    return boolify(val);
  }
}
