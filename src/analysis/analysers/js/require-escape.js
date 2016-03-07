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

// Check if the dependencies a module is trying to `require` exist in it's `package.json`.
// If they don't then it's a module potentially trying to escape and monkeypatch.
// Also check if a `require` is trying to look into the guts of a dependency. Could be
// attempting to monkeypatch it.
