/* @flow */

export default class BaseCommand {
  hasWrapper(flags: Object, args: Array<string>): boolean {
    return true;
  }
}
