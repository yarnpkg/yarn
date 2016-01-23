/* @flow */

import BaseFetcher from "./_base";
import * as fs from "../util/fs";

export default class CopyFetcher extends BaseFetcher {
  async _fetch(): Promise<string> {
    await fs.copy(this.reference.src, this.reference.dest);
    return "";
  }
}
