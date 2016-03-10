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

// Check if any files attempt to touch the `process` variable in potentially dangerous ways.
// Include cases where `process` is used as a value.
// Only allow references to specific safe `process.env` variables such as `NODE_ENV` etc.

export let visitor = {
  ReferencedIdentifier(path: any) {
    path;
  }
};
