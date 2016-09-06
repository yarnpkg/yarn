/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import type {Manifest} from '../../types.js';
import type PackageRequest from '../../package-request.js';
import {MessageError} from '../../errors.js';
import GitResolver from './git-resolver.js';
import ExoticResolver from './exotic-resolver.js';
import * as util from '../../util/misc.js';

function explodeGistFragment(fragment: string): { id: string, hash: string } {
  fragment = util.removePrefix(fragment, 'gist:');

  const parts = fragment.split('#');

  if (parts.length <= 2) {
    return {
      id: parts[0],
      hash: parts[1] || '',
    };
  } else {
    throw new MessageError(`Invalid gist fragment ${fragment}`);
  }
}

export default class GistResolver extends ExoticResolver {
  static protocol = 'gist';

  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);

    let {id, hash} = explodeGistFragment(fragment);
    this.id = id;
    this.hash = hash;
  }

  id: string;
  hash: string;

  resolve(): Promise<Manifest> {
    return this.fork(GitResolver, false, `https://gist.github.com/${this.id}.git#${this.hash}`);
  }
}
