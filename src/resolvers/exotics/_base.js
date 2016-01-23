/* @flow */

import BaseResolver from "../_base";

let _ = require("lodash");

export default class ExoticResolver extends BaseResolver {
  static isVersion(pattern: string): boolean {
    // $FlowFixMe: make flow understand this
    let proto = this.protocol;
    if (proto) {
      return _.startsWith(pattern, `${proto}:`);
    } else {
      throw new Error(`No protocol specified`);
    }
  }
}
