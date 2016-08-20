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

import RegistryNpm from './registries/NpmResolver.js';
import RegistryBower from './registries/BowerResolver.js';
import RegistryKpm from './registries/KpmResolver.js';

export let registries = {
  bower: RegistryBower,
  npm: RegistryNpm,
  kpm: RegistryKpm,
};

//

import ExoticGit from './exotics/GitResolver.js';
import ExoticTarball from './exotics/TarballResolver.js';
import ExoticGitHub from './exotics/GitHubResolver.js';
import ExoticFile from './exotics/FileResolver.js';
import ExoticGitLab from './exotics/GitlabResolver.js';
import ExoticGist from './exotics/GistResolver.js';
import ExoticBitbucket from './exotics/BitbucketResolver.js';

export let exotics = {
  git: ExoticGit,
  tarball: ExoticTarball,
  github: ExoticGitHub,
  file: ExoticFile,
  gitlab: ExoticGitLab,
  gist: ExoticGist,
  bitbucket: ExoticBitbucket,
};

//

import {explodeHostedGitFragment} from './exotics/HostedGitResolver.js';

export let hostedGit = {
  github: ExoticGitHub,
  gitlab: ExoticGitLab,
  bitbucket: ExoticBitbucket,
};

export function hostedGitFragmentToGitUrl(fragment: string): string {
  for (let key in hostedGit) {
    let Resolver = hostedGit[key];
    if (Resolver.isVersion(fragment)) {
      return Resolver.getGitHTTPUrl(explodeHostedGitFragment(fragment));
    }
  }

  return fragment;
}

//

import ExoticRegistryResolver from './exotics/RegistryResolver.js';

for (let key in registries) {
  let RegistryResolver = registries[key];

  exotics[key] = class extends ExoticRegistryResolver {
    static protocol = key;
    static factory = RegistryResolver;
  };
}
