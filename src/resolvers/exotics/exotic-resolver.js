/* @flow */

import BaseResolver from '../base-resolver.js';

export default class ExoticResolver extends BaseResolver {
  static protocol: string;

  static isVersion(pattern: string): boolean {
    const proto = this.protocol;
    if (proto) {
      return pattern.startsWith(`${proto}:`);
    } else {
      throw new Error('No protocol specified');
    }
  }
}
