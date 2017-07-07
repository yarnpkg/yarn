/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type {Manifest} from '../../types.js';
import type PackageRequest from '../../package-request.js';
import {MessageError} from '../../errors.js';
import {registries} from '../../registries/index.js';
import GitResolver from './git-resolver.js';
import ExoticResolver from './exotic-resolver.js';
import Git from '../../util/git.js';
import guessName from '../../util/guess-name.js';

export type ExplodedFragment = {
  user: string,
  repo: string,
  hash: string,
};

export function explodeHostedGitFragment(fragment: string, reporter: Reporter): ExplodedFragment {
  const preParts = fragment.split('@');
  if (preParts.length > 2) {
    fragment = preParts[1] + '@' + preParts[2];
  }

  const parts = fragment.split(':');

  if (parts.length == 3) {
    // protocol + host + folder
    parts[1] = parts[1].indexOf('//') >= 0 ? parts[1].substr(2) : parts[1];
    fragment = parts[1] + '/' + parts[2];
  } else if (parts.length == 2) {
    if (parts[0].indexOf('@') == -1) {
      // protocol + host
      fragment = parts[1];
    } else {
      // host + folder
      fragment = parts[0] + '/' + parts[1];
    }
  } else if (parts.length == 1) {
    fragment = parts[0];
  } else {
    throw new MessageError(reporter.lang('invalidHostedGitFragment', fragment));
  }

  const userParts = fragment.split('/');

  if (userParts.length >= 2) {
    if (userParts[0].indexOf('@') >= 0) {
      userParts.shift();
    }

    const user = userParts.shift();
    const repoParts = userParts.join('/').split(/(?:[.]git)?#(.*)/);

    if (repoParts.length <= 3) {
      return {
        user,
        repo: repoParts[0].replace('.git', ''),
        hash: repoParts[1] || '',
      };
    }
  }

  throw new MessageError(reporter.lang('invalidHostedGitFragment', fragment));
}

export default class HostedGitResolver extends ExoticResolver {
  constructor(request: PackageRequest, fragment: string) {
    super(request, fragment);

    const exploded = (this.exploded = explodeHostedGitFragment(fragment, this.reporter));
    const {user, repo, hash} = exploded;
    this.user = user;
    this.repo = repo;
    this.hash = hash;
  }

  exploded: ExplodedFragment;
  url: string;
  user: string;
  repo: string;
  hash: string;

  static getTarballUrl(exploded: ExplodedFragment, commit: string): string {
    exploded;
    commit;
    throw new Error('Not implemented');
  }

  static getGitHTTPUrl(exploded: ExplodedFragment): string {
    exploded;
    throw new Error('Not implemented');
  }

  static getGitHTTPBaseUrl(exploded: ExplodedFragment): string {
    exploded;
    throw new Error('Not implemented');
  }

  static getGitSSHUrl(exploded: ExplodedFragment): string {
    exploded;
    throw new Error('Not implemented');
  }

  static getHTTPFileUrl(exploded: ExplodedFragment, filename: string, commit: string) {
    exploded;
    filename;
    commit;
    throw new Error('Not implemented');
  }

  async getRefOverHTTP(url: string): Promise<string> {
    const gitUrl = Git.npmUrlToGitUrl(url);
    const client = new Git(this.config, gitUrl, this.hash);

    let out = await this.config.requestManager.request({
      url: `${url}/info/refs?service=git-upload-pack`,
      queue: this.resolver.fetchingQueue,
    });

    if (out) {
      // clean up output
      let lines = out.trim().split('\n');

      // remove first two lines which contains compatibility info etc
      lines = lines.slice(2);

      // remove last line which contains the terminator "0000"
      lines.pop();

      // remove line lengths from start of each line
      lines = lines.map((line): string => line.slice(4));

      out = lines.join('\n');
    } else {
      throw new Error(this.reporter.lang('hostedGitResolveError'));
    }

    const refs = Git.parseRefs(out);
    return client.setRef(refs);
  }

  async resolveOverHTTP(url: string): Promise<Manifest> {
    const commit = await this.getRefOverHTTP(url);
    const {config} = this;

    const tryRegistry = async (registry): Promise<?Manifest> => {
      const {filename} = registries[registry];

      const href = this.constructor.getHTTPFileUrl(this.exploded, filename, commit);
      const file = await config.requestManager.request({
        url: href,
        queue: this.resolver.fetchingQueue,
      });
      if (!file) {
        return null;
      }

      const tarballUrl = this.constructor.getTarballUrl(this.exploded, commit);
      const json = await config.readJson(href, () => JSON.parse(file));
      json._uid = commit;
      json._remote = {
        resolved: tarballUrl,
        type: 'tarball',
        reference: tarballUrl,
        registry,
      };
      return json;
    };

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

    return {
      name: guessName(url),
      version: '0.0.0',
      _uid: commit,
      _remote: {
        hash: commit,
        resolved: url,
        type: 'tarball',
        reference: url,
        registry: 'npm',
      },
    };
  }

  async hasHTTPCapability(url: string): Promise<boolean> {
    return (
      (await this.config.requestManager.request({
        url,
        method: 'HEAD',
        queue: this.resolver.fetchingQueue,
        followRedirect: false,
      })) !== false
    );
  }

  async resolve(): Promise<Manifest> {
    // If we already have the tarball, just return it without having to make any HTTP requests.
    const shrunk = this.request.getLocked('tarball');
    if (shrunk) {
      return shrunk;
    }

    const httpUrl = this.constructor.getGitHTTPUrl(this.exploded);
    const httpBaseUrl = this.constructor.getGitHTTPBaseUrl(this.exploded);
    const sshUrl = this.constructor.getGitSSHUrl(this.exploded);

    // If we can access the files over HTTP then we should as it's MUCH faster than git
    // archive and tarball unarchiving. The HTTP API is only available for public repos
    // though.
    if (await this.hasHTTPCapability(httpBaseUrl)) {
      return this.resolveOverHTTP(httpUrl);
    }

    // If the url is accessible over git archive then we should immediately delegate to
    // the git resolver.
    //
    // NOTE: Here we use a different url than when we delegate to the git resolver later on.
    // This is because `git archive` requires access over ssh and github only allows that
    // if you have write permissions
    const sshGitUrl = Git.npmUrlToGitUrl(sshUrl);
    if (await Git.hasArchiveCapability(sshGitUrl)) {
      const archiveClient = new Git(this.config, sshGitUrl, this.hash);
      const commit = await archiveClient.init();
      return this.fork(GitResolver, true, `${sshUrl}#${commit}`);
    }

    // fallback to the plain git resolver
    return this.fork(GitResolver, true, sshUrl);
  }
}
