/* @flow */

import type { PackageInfo } from "../../types.js";
import validate from "./validate.js";
import fix from "./fix.js";

export default async function (
  info: Object,
  moduleLoc: string,
  warn?: ?(msg: string) => void,
): Promise<PackageInfo> {
  if (info.private) warn = null;
  if (!warn) warn = function () {};
  validate(info, moduleLoc, warn);
  await fix(info, moduleLoc);
  return info;
}
