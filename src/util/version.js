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

export function explodeHashedUrl(url: string): { url: string, hash: string } {
  let parts = url.split("#");

  return {
    url: parts[0],
    hash: parts[1] || ""
  };
}
