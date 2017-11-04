/* @flow */

export function boolify(val: any): boolean {
  return val.toString().toLowerCase() !== 'false' && val !== '0';
}

export function boolifyWithDefault(val: any, defaultResult: boolean): boolean {
  if (val === undefined || val === null || val === '') {
    return defaultResult;
  } else {
    return boolify(val);
  }
}
