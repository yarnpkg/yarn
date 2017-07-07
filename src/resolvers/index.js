/* @flow */

import BaseResolver from './base-resolver.js';

import RegistryNpm from './registries/npm-resolver.js';
import RegistryYarn from './registries/yarn-resolver.js';

export const registries = {
  npm: RegistryNpm,
  yarn: RegistryYarn,
};

//

import ExoticGit from './exotics/git-resolver.js';
import ExoticTarball from './exotics/tarball-resolver.js';
import ExoticGitHub from './exotics/github-resolver.js';
import ExoticFile from './exotics/file-resolver.js';
import ExoticLink from './exotics/link-resolver.js';
import ExoticGitLab from './exotics/gitlab-resolver.js';
import ExoticGist from './exotics/gist-resolver.js';
import ExoticBitbucket from './exotics/bitbucket-resolver.js';

const exotics: Set<Class<$Subtype<BaseResolver>>> = new Set([
  ExoticGit,
  ExoticTarball,
  ExoticGitHub,
  ExoticFile,
  ExoticLink,
  ExoticGitLab,
  ExoticGist,
  ExoticBitbucket,
]);

export function getExoticResolver(pattern: string): ?Class<$Subtype<BaseResolver>> {
  for (const Resolver of exotics) {
    if (Resolver.isVersion(pattern)) {
      return Resolver;
    }
  }
  return null;
}

//

import type {Reporter} from '../reporters/index.js';
import {explodeHostedGitFragment} from './exotics/hosted-git-resolver.js';

export const hostedGit = {
  github: ExoticGitHub,
  gitlab: ExoticGitLab,
  bitbucket: ExoticBitbucket,
};

export function hostedGitFragmentToGitUrl(fragment: string, reporter: Reporter): string {
  for (const key in hostedGit) {
    const Resolver = hostedGit[key];
    if (Resolver.isVersion(fragment)) {
      return Resolver.getGitHTTPUrl(explodeHostedGitFragment(fragment, reporter));
    }
  }

  return fragment;
}

//

import ExoticRegistryResolver from './exotics/registry-resolver.js';

for (const key in registries) {
  const RegistryResolver = registries[key];

  exotics.add(
    class extends ExoticRegistryResolver {
      static protocol = key;
      static factory = RegistryResolver;
    },
  );
}
