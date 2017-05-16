/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type {Manifest} from '../../types.js';
import type PackageRequest from '../../package-request.js';
import {MessageError} from '../../errors.js';
import GitResolver from './git-resolver.js';
import ExoticResolver from './exotic-resolver.js';
import * as util from '../../util/misc.js';

export function explodeGistFragment(fragment: string, reporter: Reporter): {id: string, hash: string} {
  fragment = util.removePrefix(fragment, 'gist:');

  const parts = fragment.split('#');

  if (parts.length <= 2) {
    return {
      id: parts[0],
      hash: parts[1] || '',
    };
  } else {
    throw new MessageError(reporter.lang('invalidGistFragment', fragment));
  }
}

export default class GistResolver extends ExoticResolver {
  static protocol = 'gist';

  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);

    const {id, hash} = explodeGistFragment(fragment, this.reporter);
    this.id = id;
    this.hash = hash;
  }

  id: string;
  hash: string;

  resolve(): Promise<Manifest> {
    return this.fork(GitResolver, false, `https://gist.github.com/${this.id}.git#${this.hash}`);
  }
}
