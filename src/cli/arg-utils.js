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

/**
 * Determines if a given array contains the min number of acceptable arguments.
 */

export function hasValidArgLength(
  requiredLength: number,
  minLength: number,
  args: Array<string> = []
): boolean {
  if (requiredLength !== undefined) {
    return minLength === args.length;
  }

  if (minLength !== undefined) {
    return args.length >= minLength;
  }

  return true;
}

/**
 * Gets the subarguments for a given command.
 */

export function getSubArguments(
  args: Array<string> = [],
  minArgumentLength: number = 0
): string {
  return args.slice(minArgumentLength).join(" ");
}
