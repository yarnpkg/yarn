/* @flow */

import type { PackageInfo } from "../../types.js";
import type PackageRequest from "../../package-request.js";
import { MessageError } from "../../errors.js";
import GitResolver from "./git.js";
import ExoticResolver from "./_base.js";
import * as util from "../../util/misc.js";

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
