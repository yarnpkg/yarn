/* @flow */

import type {RegistryNames} from './registries/index.js';
import type PackageReference from './package-reference.js';
import type {VisibilityAction} from './package-reference.js';
import type PackageRequest from './package-request.js';
import type {FetcherNames} from './fetchers/index.js';

// dependency request pattern data structure that's used to request dependencies from a
// PackageResolver
export type DependencyRequestPattern = {
  pattern: string,
  registry: RegistryNames,
  optional: boolean,
  visibility: VisibilityAction,
  hint?: ?string,
  parentRequest?: ?PackageRequest,
};
export type DependencyRequestPatterns = Array<DependencyRequestPattern>;

// person object, the exploded version of a `maintainers`/`authors` field
export type PersonObject = {
  email?: string,
  name?: string,
  url?: string
};

// package remote that's used to store how to fetch a package
export type PackageRemote = {
  type: FetcherNames,
  registry: RegistryNames,
  reference: string,
  resolved?: ?string,
  hash?: ?string,
};

// `dependencies` field in package info
type Dependencies = {
  [key: string]: string
};

// package.json/bower.json etc
export type Manifest = {
  _registry?: ?RegistryNames,
  _loc?: ?string,

  name: string,
  version: string,

  flat?: boolean,
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
  _reference?: ?PackageReference,

  // unique identifier to refer to this package by, if it doesn't exist in a registry then
  // we need to use this to ensure it's unique
  _uid: string,

  _remote?: ?PackageRemote,

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
export type FetchedMetadata = {
  package: Manifest,
  resolved: ?string,
  hash: string,
  dest: string,
};
export type FetchedOverride = {
  hash: string,
  resolved: ?string,
};
