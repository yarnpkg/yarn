/* @flow */

import BaseFetcher from './base-fetcher.js';
import CopyFetcher from './copy-fetcher.js';
import GitFetcher from './git-fetcher.js';
import TarballFetcher from './tarball-fetcher.js';
import WorkspaceFetcher from './workspace-fetcher.js';

export {BaseFetcher as base};
export {CopyFetcher as copy};
export {GitFetcher as git};
export {TarballFetcher as tarball};
export {WorkspaceFetcher as workspace};

export type Fetchers = BaseFetcher | CopyFetcher | GitFetcher | TarballFetcher | WorkspaceFetcher;

export type FetcherNames = 'base' | 'copy' | 'git' | 'link' | 'tarball' | 'workspace';
