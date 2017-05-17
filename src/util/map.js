/* @flow */

type Return<T> = T | Object;

export default function nullify<T>(obj?: Return<T> = {}): Return<T> {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      nullify(item);
    }
  } else if ((obj !== null && typeof obj === 'object') || typeof obj === 'function') {
    Object.setPrototypeOf(obj, null);

    // for..in can only be applied to 'object', not 'function'
    if (typeof obj === 'object') {
      for (const key in obj) {
        nullify(obj[key]);
      }
    }
  }

  return obj;
}
