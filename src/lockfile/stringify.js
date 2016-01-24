/* @flow */

function shouldWrapKey(str) {
  return str.indexOf("true") === 0 || str.indexOf("false") === 0 || /[:\s]/g.test(str);
}

const priorities = {
  name: 4,
  version: 3,
  resolved: 2,
  dependencies: 1
};

export default function stringify(obj: any, indent: string = ""): string {
  if (typeof obj !== "object") {
    throw new TypeError;
  }

  let lines = [];

  let keys = Object.keys(obj).sort().sort(function (a, b) {
    return (priorities[a] || 0) < (priorities[b] || 0);
  });

  for (let key of keys) {
    let val = obj[key];
    if (val === undefined) continue;

    if (shouldWrapKey(key)) {
      key = JSON.stringify(key);
    }

    if (typeof val === "string" || typeof val === "boolean") {
      lines.push(`${key} ${JSON.stringify(val)}`);
    } else if (typeof val === "object") {
      lines.push(`${key}: \n${stringify(val, indent + "  ")}`);
    } else {
      throw new TypeError;
    }
  }

  return indent + lines.join(`\n${indent}`);
}
