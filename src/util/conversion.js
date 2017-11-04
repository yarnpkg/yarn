/* @flow */

export function boolify(val: string|number|boolean): boolean {
  return val.toString().toLowerCase() !== 'false' && val !== '0';
}

export function boolifyWithDefault(val: ?(string|number|boolean), defaultResult: boolean): boolean {
  if (val === undefined || val === null || val === '') {
    return defaultResult;
  } else {
    return boolify(val);
  }
}
