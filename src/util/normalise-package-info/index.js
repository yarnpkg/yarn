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

import type { PackageInfo } from "../../types.js";
import validate from "./validate.js";
import fix from "./fix.js";

type WarnFunction = ?(msg: string) => void;

export default async function (info: Object, moduleLoc: string, warn?: WarnFunction): Promise<PackageInfo> {
  if (info.private) warn = null;
  if (!warn) warn = function () {};
  await fix(info, moduleLoc);
  validate(info, moduleLoc, warn);
  return info;
}
