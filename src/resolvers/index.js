/* @flow */

import RegistryNpm from './registries/npm-resolver.js';
import RegistryBower from './registries/bower-resolver.js';
import RegistryYarn from './registries/yarn-resolver.js';

export let registries = {
  bower: RegistryBower,
  npm: RegistryNpm,
  yarn: RegistryYarn,
};

//

import ExoticGit from './exotics/git-resolver.js';
import ExoticTarball from './exotics/tarball-resolver.js';
import ExoticGitHub from './exotics/github-resolver.js';
import ExoticFile from './exotics/file-resolver.js';
import ExoticGitLab from './exotics/gitlab-resolver.js';
import ExoticGist from './exotics/gist-resolver.js';
import ExoticBitbucket from './exotics/bitbucket-resolver.js';

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

import type {Reporter} from '../reporters/index.js';
import {explodeHostedGitFragment} from './exotics/hosted-git-resolver.js';

export let hostedGit = {
  github: ExoticGitHub,
  gitlab: ExoticGitLab,
  bitbucket: ExoticBitbucket,
};

export function hostedGitFragmentToGitUrl(fragment: string, reporter: Reporter): string {
  for (let key in hostedGit) {
    let Resolver = hostedGit[key];
    if (Resolver.isVersion(fragment)) {
      return Resolver.getGitHTTPUrl(explodeHostedGitFragment(fragment, reporter));
    }
  }

  return fragment;
}

//

import ExoticRegistryResolver from './exotics/registry-resolver.js';

for (let key in registries) {
  let RegistryResolver = registries[key];

  exotics[key] = class extends ExoticRegistryResolver {
    static protocol = key;
    static factory = RegistryResolver;
  };
}
