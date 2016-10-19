/* @flow */

import type {Manifest} from '../../types.js';
import type PackageRequest from '../../package-request.js';
import {hostedGit as hostedGitResolvers} from '../index.js';
import {MessageError} from '../../errors.js';
import * as util from '../../util/misc.js';
import * as versionUtil from '../../util/version.js';
import {registries} from '../../registries/index.js';
import ExoticResolver from './exotic-resolver.js';
import Git from '../../util/git.js';

const urlParse = require('url').parse;

// we purposefully omit https and http as those are only valid if they end in the .git extension
const GIT_PROTOCOLS = ['git:', 'git+ssh:', 'git+https:', 'ssh:'];

const GIT_HOSTS = ['github.com', 'gitlab.com', 'bitbucket.com'];

export default class GitResolver extends ExoticResolver {
  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);

    const {url, hash} = versionUtil.explodeHashedUrl(fragment);
    this.url = url;
    this.hash = hash;
  }

  url: string;
  hash: string;

  static isVersion(pattern: string): boolean {
    const parts = urlParse(pattern);

    // this pattern hasn't been exploded yet, we'll hit this code path again later once
    // we've been normalized #59
    if (!parts.protocol) {
      return false;
    }

    const pathname = parts.pathname;
    if (pathname && pathname.endsWith('.git')) {
      // ends in .git
      return true;
    }

    if (GIT_PROTOCOLS.indexOf(parts.protocol) >= 0) {
      return true;
    }

    if (parts.hostname && parts.path) {
      const path = parts.path;
      if (GIT_HOSTS.indexOf(parts.hostname) >= 0) {
        // only if dependency is pointing to a git repo,
        // e.g. facebook/flow and not file in a git repo facebook/flow/archive/v1.0.0.tar.gz
        return path.split('/').filter((p): boolean => !!p).length === 2;
      }
    }

    return false;
  }

  async resolve(forked?: true): Promise<Manifest> {
    const {url} = this;

    // shortcut for hosted git. we will fallback to a GitResolver if the hosted git
    // optimisations fail which the `forked` flag indicates so we don't get into an
    // infinite loop
    const parts = urlParse(url);
    if (false && !forked && !parts.auth && parts.pathname) {
      // check if this git url uses any of the hostnames defined in our hosted git resolvers
      for (const name in hostedGitResolvers) {
        const Resolver = hostedGitResolvers[name];
        if (Resolver.hostname !== parts.hostname) {
          continue;
        }

        // we have a match! clean up the pathname of url artifacts
        let pathname = parts.pathname;
        pathname = util.removePrefix(pathname, '/'); // remove prefixed slash
        pathname = util.removeSuffix(pathname, '.git'); // remove .git suffix if present

        const url = `${pathname}${this.hash ? '#' + decodeURIComponent(this.hash) : ''}`;
        return this.fork(Resolver, false, url);
      }
    }

    // get from lockfile
    const shrunk = this.request.getLocked('git');
    if (shrunk) {
      return shrunk;
    }

    const client = new Git(this.config, url, this.hash);
    const commit = await client.initRemote();

    async function tryRegistry(registry): Promise<?Manifest> {
      const {filename} = registries[registry];

      const file = await client.getFile(filename);
      if (!file) {
        return null;
      }

      const json = JSON.parse(file);
      json._uid = commit;
      json._remote = {
        resolved: `${url}#${commit}`,
        type: 'git',
        reference: url,
        hash: commit,
        registry,
      };
      return json;
    }

    const file = await tryRegistry(this.registry);
    if (file) {
      return file;
    }

    for (const registry in registries) {
      if (registry === this.registry) {
        continue;
      }

      const file = await tryRegistry(registry);
      if (file) {
        return file;
      }
    }

    throw new MessageError(this.reporter.lang('couldntFindManifestIn', url));
  }
}
