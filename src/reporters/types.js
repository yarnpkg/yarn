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
/* global stream$Writable */
/* global stream$Readable */
/* global tty$ReadStream */
/* global tty$WriteStream */

export type Stdout = stream$Writable | tty$WriteStream;
export type Stdin = stream$Readable | tty$ReadStream;
export type Package = {
  name: string,
  version: string
};

export type Tree = {
  name: string,
  children?: Trees,
  hint?: ?string,
  hidden?: boolean,
  color?: ?string
};

export type Trees = Array<Tree>;
