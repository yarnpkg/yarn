/* @flow */

function shouldWrapKey(str: string): boolean {
  return str.indexOf("true") === 0 || str.indexOf("false") === 0 || /[:\s\n\\"]/g.test(str);
}

function maybeWrap(str: string): string {
  if (typeof str === "boolean" || shouldWrapKey(str)) {
    return JSON.stringify(str);
  } else {
    return str;
  }
}

const priorities = {
  name: 1,
  version: 2,
  uid: 3,
  resolved: 4,
  registry: 5,
  dependencies: 6
};

function getKeyPriority(key: string): number {
  return priorities[key] || 100;
}

export default function stringify(obj: any, indent: string = ""): string {
  if (typeof obj !== "object") {
    throw new TypeError;
  }

  let lines = [];

  let keys = Object.keys(obj).sort(function (a, b) {
    // sort alphabetically
    return a.toLowerCase().localeCompare(b.toLowerCase());
  }).sort(function (a, b) {
    // prioritise certain fields
    return +(getKeyPriority(a) > getKeyPriority(b));
  });

  for (let key of keys) {
    let val = obj[key];
    if (val === undefined) continue;

    key = maybeWrap(key);

    if (typeof val === "string" || typeof val === "boolean") {
      lines.push(`${key} ${maybeWrap(val)}`);
    } else if (typeof val === "object") {
      lines.push(`${key}: \n${stringify(val, indent + "  ")}`);
    } else {
      throw new TypeError;
    }
  }

  return indent + lines.join(`\n${indent}`);
}
