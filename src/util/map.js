/* @flow */

type Return<T> = T | Object;

export default function nullify<T>(obj?: Return<T> = {}): Return<T> {
  if (Array.isArray(obj)) {
    for (let item of obj) {
      nullify(item);
    }
  } else if (typeof obj === "object" || typeof obj === "function") {
    // $FlowFixMe: https://github.com/facebook/flow/pull/1343
    Object.setPrototypeOf(obj, null);
    for (let key in obj) {
      nullify(obj[key]);
    }
  }

  return obj;
}
