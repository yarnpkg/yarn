/* @flow */

import type { PackageInfo } from "../../types";
import validate from "./validate";
import fix from "./fix";

export default async function (info: Object, moduleLoc: string, warn?: ?(msg: string) => void): Promise<PackageInfo> {
  if (info.private) warn = null;
  validate(info, moduleLoc, warn);
  await fix(info, moduleLoc);
  return info;
}
