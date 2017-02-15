/* @flow */

import BaseFetcher from './base-fetcher.js';
import CopyFetcher from './copy-fetcher.js';
import GitFetcher from './git-fetcher.js';
import TarballFetcher from './tarball-fetcher.js';
import OpamFetcher from './opam-fetcher.js';

export {BaseFetcher as base};
export {CopyFetcher as copy};
export {GitFetcher as git};
export {TarballFetcher as tarball};
export {OpamFetcher as opam};

export type Fetchers =
  | BaseFetcher
  | CopyFetcher
  | GitFetcher
  | OpamFetcher
  | TarballFetcher;

export type FetcherNames =
  | 'base'
  | 'copy'
  | 'git'
  | 'opam'
  | 'tarball';
