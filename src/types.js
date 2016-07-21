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

import type { RegistryNames } from "./registries/index.js";
import type PackageReference from "./package-reference.js";

// dependency request pattern data structure that's used to request dependencies from a
// PackageResolver
export type DependencyRequestPatterns = Array<{
  pattern: string,
  registry: RegistryNames,
  optional?: boolean,
  ignore?: boolean,
  hint?: ?string
}>;

// person object, the exploded version of a `maintainers`/`authors` field
export type PersonObject = {
  email?: string,
  name?: string,
  url?: string
};

// package remote that's used to store how to fetch a package
export type PackageRemote = {
  type: "tarball" | "git" | "copy" | "base",
  registry: RegistryNames,
  reference: string,
  resolved?: ?string,
  hash?: ?string,
};

// `dependencies` field in package info
type Dependencies = {
  [key: string]: string
};

// package info is the complete package.json of a package
export type Manifest = {
  name: string,
  version: string,

  license?: string,
  licenseText?: string,

  readme?: string,
  readmeFilename?: string,

  repository?: {
    type: "git",
    url: string
  },

  bugs?: {
    url: string
  },

  // the package reference that we pass around as a minimal way to refer to it
  reference?: ?PackageReference,

  // unique identifier to refer to this package by, if it doesn't exist in a registry then
  // we need to use this to ensure it's unique
  uid: string,

  remote?: ?PackageRemote,

  dist?: {
    tarball: string,
    shasum: string
  },

  directories?: {
    man: string,
    bin: string
  },

  man?: Array<string>,

  bin?: {
    [name: string]: string
  },

  scripts?: {
    [name: string]: string
  },

  engines?: {
    [engineName: string]: string
  },

  os?: Array<string>,
  cpu?: Array<string>,

  dependencies?: Dependencies,
  devDependencies?: Dependencies,
  peerDependencies?: Dependencies,
  optionalDependencies?: Dependencies,

  bundleDependencies?: Array<string>,
  bundledDependencies?: Array<string>,
};

//
export type FetchedManifest = {
  package: Manifest,
  hash: string,
  dest: string
};
