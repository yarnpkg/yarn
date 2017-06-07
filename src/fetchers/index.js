/* @flow */

import BaseFetcher from './base-fetcher.js';
import CopyFetcher from './copy-fetcher.js';
import GitFetcher from './git-fetcher.js';
import TarballFetcher from './tarball-fetcher.js';

export {BaseFetcher as base};
export {CopyFetcher as copy};
export {GitFetcher as git};
export {TarballFetcher as tarball};

export type Fetchers = BaseFetcher | CopyFetcher | GitFetcher | TarballFetcher;

export type FetcherNames = 'base' | 'copy' | 'git' | 'link' | 'tarball' | 'workspace';
