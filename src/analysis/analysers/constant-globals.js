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

 // Detect globals being assigned, include places where globals are used as values.
// This does not prevent access to globals via the prototype chain such as:
//
//   ({}).__proto__ === Object;
//
// This would need to be combined with a runtime patch of:
//
//   Object.freeze(Object);
//   Object.freeze(Object.prototype);
//   // same for all other type variables
//
