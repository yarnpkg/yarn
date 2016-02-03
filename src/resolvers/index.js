/* @flow */

import RegistryNpm from "./registries/npm";
import RegistryBower from "./registries/bower";

export let registries = {
  bower: RegistryBower,
  npm: RegistryNpm
};

//

import ExoticGit from "./exotics/git";
import ExoticTarball from "./exotics/tarball";
import ExoticGitHub from "./exotics/github";
import ExoticFile from "./exotics/file";
import ExoticGitLab from "./exotics/gitlab";
import ExoticGist from "./exotics/gist";
import ExoticBitbucket from "./exotics/bitbucket";

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

import { explodeHostedGitFragment } from "./exotics/_hosted-git";

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

import ExoticRegistryResolver from "./exotics/_registry";

for (let key in registries) {
  let RegistryResolver = registries[key];

  exotics[key] = class extends ExoticRegistryResolver {
    static protocol = key;
    static factory = RegistryResolver;
  };
}
