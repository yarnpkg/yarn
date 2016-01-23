/* @flow */

import type { PackageInfo } from "../../types";
import type PackageRequest from "../../package-request";
import { MessageError } from "../../errors";
import GitResolver from "./git";
import ExoticResolver from "./_base";
import * as util from "../../util/misc";

function explodeGistFragment(fragment: string): { id: string, hash: string } {
  fragment = util.removePrefix(fragment, "gist:");

  let parts = fragment.split("#");

  if (parts.length <= 2) {
    return {
      id: parts[0],
      hash: parts[1] || ""
    };
  } else {
    throw new MessageError(`Invalid gist fragment ${fragment}`);
  }
}

export default class GistResolver extends ExoticResolver {
  // $FlowFixMe: i know what i'm doing
  static protocol = "gist";

  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);

    let { id, hash } = explodeGistFragment(fragment);
    this.id = id;
    this.hash = hash;
  }

  id: string;
  hash: string;

  resolve(): Promise<PackageInfo> {
    return this.fork(GitResolver, false, `https://gist.github.com/${this.id}.git#${this.hash}`);
  }
}
