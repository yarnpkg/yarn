/* @flow */

// Find potential dynamic requires that could be dangerous.

import { DANGEROUS_CATEGORY } from "../constants.js";

export let visitor = {
  ReferencedIdentifier(path: any) {
    // We need to disallow using `require` as a value since we can't track it.
    // We need to restrict access to `require.cache` and thus any computed access to `require`.
    if (path.node.name === "require" && !path.parentPath.isCallExpression({ callee: path.node })) {
      path.mark(DANGEROUS_CATEGORY, "Unboxed `require`");
    }

    // Only allow access to `module.exports`, refuse use of `module` as a value. `module`
    // has several properties that can be escaped such as `parent` and `require`.
    if (path.node.name === "module") {
      let invalid = false;

      if (path.parentPath.isMemberExpression({ object: path.node })) {
        invalid = !path.parentPath.matchesPattern("module.exports");
      } else {
        invalid = true;
      }

      if (invalid) {
        path.mark(DANGEROUS_CATEGORY, "Unboxed `module`");
      }
    }
  },

  CallExpression(path: any) {
    if (!path.get("callee").isIdentifier({ name: "require" })) return;

    let args = path.get("arguments");
    if (args.length !== 1) {
      path.mark(DANGEROUS_CATEGORY, `require call with ${args.length} arguments`);
      return;
    }

    let arg = args[0];

    // We can safely allow `require`s that are binary + expressions where the left side is
    // a string that starts with a special character.
    if (arg.isBinaryExpression({ operator: "+" })) {
      let left = arg.get("left");
      if (left.isStringLiteral() && left.value[0] === ".") {
        return;
      }
    }

    // Same goes for template literals.
    if (arg.isTemplateLiteral()) {
      let firstQuasi = arg.node.quasis[0];
      if (firstQuasi.value.raw[0] === ".") {
        return;
      }
    }

    if (!arg.isStringLiteral()) {
      path.mark(DANGEROUS_CATEGORY, "Non string literal require, this can require any module!");
      return;
    }

    // We need to disallow `require`s to `module` too as that will give direct access to
    // module APIs.
    let value = path.node.value;
    if (value === "module") {
      path.mark(DANGEROUS_CATEGORY, "Require to module, this will allow access to internal module methods");
    }
  }
};
