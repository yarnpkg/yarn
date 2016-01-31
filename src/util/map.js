/* @flow */

export default function nullify<T>(obj: T): T {
  if (typeof obj === "object") {
    // $FlowFixMe: https://github.com/facebook/flow/pull/1343
    Object.setPrototypeOf(obj, null);
    for (var key in obj) {
      nullify(obj[key]);
    }
  }

  return obj;
}
