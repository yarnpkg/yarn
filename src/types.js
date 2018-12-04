/* @flow */

import type {RegistryNames} from './registries/index.js';
import type PackageReference from './package-reference.js';
import type PackageRequest from './package-request.js';
import type {FetcherNames} from './fetchers/index.js';
import type {Reporter} from './reporters/index.js';
import type Config from './config.js';
import type {RequestHint} from './constants';

export type CLIFunction = (config: Config, reporter: Reporter, flags: Object, args: Array<string>) => CLIFunctionReturn;

type _CLIFunctionReturn = boolean;
export type CLIFunctionReturn = ?_CLIFunctionReturn | Promise<?_CLIFunctionReturn>;

// dependency request pattern data structure that's used to request dependencies from a
// PackageResolver
export type DependencyRequestPattern = {
  pattern: string,
  registry: RegistryNames,
  optional: boolean,
  hint?: ?RequestHint,
  parentNames?: Array<string>,
  parentRequest?: ?PackageRequest,
  workspaceName?: string,
  workspaceLoc?: string,
};
export type DependencyRequestPatterns = Array<DependencyRequestPattern>;

// person object, the exploded version of a `maintainers`/`authors` field
export type PersonObject = {
  email?: string,
  name?: string,
  url?: string,
};

// package remote that's used to store how to fetch a package
export type PackageRemote = {
  type: FetcherNames,
  registry: RegistryNames,
  reference: string,
  resolved?: ?string,
  hash: ?string,
  integrity?: ?string,
  packageName?: string,
  registryRemote?: ?PackageRemote,
};

// `dependencies` field in package info
type Dependencies = {
  [key: string]: string,
};

export type WorkspacesConfig = {
  packages?: Array<string>,
  nohoist?: Array<string>,
};

// package.json
export type Manifest = {
  _registry?: ?RegistryNames,
  _loc?: ?string,

  name: string,
  version: string,

  private?: boolean,

  author?: {
    name?: string,
    email?: string,
    url?: string,
  },

  homepage?: string,
  flat?: boolean,
  license?: string,
  licenseText?: string,
  noticeText?: string,

  readme?: string,
  readmeFilename?: string,

  repository?: {
    type: 'git',
    url: string,
  },

  bugs?: {
    url: string,
  },

  // the package reference that we pass around as a minimal way to refer to it
  _reference?: ?PackageReference,

  // unique identifier to refer to this package by, if it doesn't exist in a registry then
  // we need to use this to ensure it's unique
  _uid: string,

  _remote?: ?PackageRemote,
  _resolved?: string,

  dist?: {
    tarball: string,
    shasum: string,
  },

  directories?: {
    man: string,
    bin: string,
  },

  man?: Array<string>,

  bin?: {
    [name: string]: string,
  },

  scripts?: {
    [name: string]: string,
  },

  engines?: {
    [engineName: string]: string,
  },

  os?: Array<string>,
  cpu?: Array<string>,

  dependencies?: Dependencies,
  devDependencies?: Dependencies,
  peerDependencies?: Dependencies,
  optionalDependencies?: Dependencies,

  bundleDependencies?: Array<string>,
  bundledDependencies?: Array<string>,

  installConfig?: {
    pnp?: boolean,
  },

  deprecated?: string,
  files?: Array<string>,
  main?: string,

  workspaces?: Array<string> | WorkspacesConfig,

  // This flag is true when we add a new package with `yarn add <mypackage>`.
  // We need to preserve the flag because we print a list of new packages in
  // the end of the add command
  fresh?: boolean,

  prebuiltVariants?: {[filename: string]: string},
};

//
export type FetchedMetadata = {
  package: Manifest,
  hash: string,
  dest: string,
  cached: boolean,
};
export type FetchedOverride = {
  hash: string,
};

// Used by outdated and upgrade-interactive
export type Dependency = {
  name: string,
  current: string,
  wanted: string,
  latest: string,
  url: string,
  hint: ?string,
  range: string,
  upgradeTo: string,
  workspaceName: string,
  workspaceLoc: string,
};

export type WorkspacesManifestMap = {
  [string]: {loc: string, manifest: Manifest},
};
