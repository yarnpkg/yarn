/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

// Identify code that uses DOM related APIs or attempts to access or read the DOM.
// `document`, `document.cookie`, `navigator` etc.

import { DANGEROUS_CATEGORY } from "../../constants.js";

export let visitor = {
  ReferencedIdentifier(path: any) {
    let name = path.node.name;
    if (name === "navigator" || name === "document") {
      path.mark(DANGEROUS_CATEGORY, "Potential DOM access");
    }
  }
};
