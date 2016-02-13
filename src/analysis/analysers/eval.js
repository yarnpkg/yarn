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

 // Find code that uses `eval`, `new Function` etc.
//
// BUT this check can be escaped by doing `new (function () {}).constructor` so for full
// protection this needs to be coupled with a runtime patch of:
//
//   Function.prototype.constructor = null;
//
