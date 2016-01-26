/* @flow */

import BaseResolver from "../_base";

let _ = require("lodash");

export default class ExoticResolver extends BaseResolver {
  static protocol: string;

  static isVersion(pattern: string): boolean {
    let proto = this.protocol;
    if (proto) {
      return _.startsWith(pattern, `${proto}:`);
    } else {
      throw new Error(`No protocol specified`);
    }
  }
}
