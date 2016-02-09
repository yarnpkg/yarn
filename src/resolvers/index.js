/* @flow */

import RegistryNpm from "./registries/npm.js";
import RegistryBower from "./registries/bower.js";

export let registries = {
  bower: RegistryBower,
  npm: RegistryNpm
};

//

import ExoticGit from "./exotics/git.js";
import ExoticTarball from "./exotics/tarball.js";
import ExoticGitHub from "./exotics/github.js";
import ExoticFile from "./exotics/file.js";
import ExoticGitLab from "./exotics/gitlab.js";
import ExoticGist from "./exotics/gist.js";
import ExoticBitbucket from "./exotics/bitbucket.js";

export let exotics = {
  git: ExoticGit,
  tarball: ExoticTarball,
  github: ExoticGitHub,
  file: ExoticFile,
  gitlab: ExoticGitLab,
  gist: ExoticGist,
  bitbucket: ExoticBitbucket
};

//

import { explodeHostedGitFragment } from "./exotics/_hosted-git.js";

export let hostedGit = {
  github: ExoticGitHub,
  gitlab: ExoticGitLab,
  bitbucket: ExoticBitbucket
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

import ExoticRegistryResolver from "./exotics/_registry.js";

for (let key in registries) {
  let RegistryResolver = registries[key];

  exotics[key] = class extends ExoticRegistryResolver {
    static protocol = key;
    static factory = RegistryResolver;
  };
}
