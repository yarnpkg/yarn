/* @flow */

import RegistryNpm from "./registries/npm";
import RegistryBower from "./registries/bower";

let _ = require("lodash");

export type PackageRegistry = "bower" | "npm";

export let registries = {
  bower: RegistryBower,
  npm: RegistryNpm
};

export let REGISTRY_METADATA_FILENAMES = _.map(registries, "filename");

export function getRegistryResolver(registry: PackageRegistry): Function {
  let Resolver = registries[registry];
  if (Resolver) {
    return Resolver;
  } else {
    throw new Error(`Unknown registry resolver ${registry}`);
  }
}

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

import ExoticRegistryResolver from "./exotics/_registry";

for (let key in registries) {
  let RegistryResolver = registries[key];

  exotics[key] = class extends ExoticRegistryResolver {
    static protocol = key;
    static factory = RegistryResolver;
  };
}
