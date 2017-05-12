/* @flow */

import BaseFetcher from './base-fetcher.js';
import CopyFetcher from './copy-fetcher.js';
import GitFetcher from './git-fetcher.js';
import TarballFetcher, {LocalTarballFetcher} from './tarball-fetcher.js';

export {BaseFetcher as base};
export {CopyFetcher as copy};
export {GitFetcher as git};
export {TarballFetcher as tarball};
export {LocalTarballFetcher as localTarball};

export type Fetchers =
  | BaseFetcher
  | CopyFetcher
  | GitFetcher
  | TarballFetcher
  | LocalTarballFetcher;

export type FetcherNames =
  | 'base'
  | 'copy'
  | 'git'
  | 'tarball'
  | 'localTarball';
