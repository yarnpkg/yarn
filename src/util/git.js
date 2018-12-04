/* @flow */

import invariant from 'invariant';
import {StringDecoder} from 'string_decoder';
import tarFs from 'tar-fs';
import tarStream from 'tar-stream';
import url from 'url';
import {createWriteStream} from 'fs';

import type Config from '../config.js';
import type {Reporter} from '../reporters/index.js';
import type {ResolvedSha, GitRefResolvingInterface, GitRefs} from './git/git-ref-resolver.js';
import {MessageError, ProcessSpawnError} from '../errors.js';
import {spawn as spawnGit} from './git/git-spawn.js';
import {resolveVersion, isCommitSha, parseRefs} from './git/git-ref-resolver.js';
import * as crypto from './crypto.js';
import * as fs from './fs.js';
import map from './map.js';
import {removePrefix} from './misc.js';

const GIT_PROTOCOL_PREFIX = 'git+';
const SSH_PROTOCOL = 'ssh:';
const SCP_PATH_PREFIX = '/:';
const FILE_PROTOCOL = 'file:';
const GIT_VALID_REF_LINE_REGEXP = /^([a-fA-F0-9]+|ref)/;

const validRef = line => {
  return GIT_VALID_REF_LINE_REGEXP.exec(line);
};

type GitUrl = {
  protocol: string, // parsed from URL
  hostname: ?string,
  repository: string, // git-specific "URL"
};

const supportsArchiveCache: {[key: string]: boolean} = map({
  'github.com': false, // not support, doubt they will ever support it
});

const handleSpawnError = err => {
  if (err instanceof ProcessSpawnError) {
    throw err;
  }
};

const SHORTHAND_SERVICES: {[key: string]: url.parse} = map({
  'github:': parsedUrl => ({
    ...parsedUrl,
    slashes: true,
    auth: 'git',
    protocol: SSH_PROTOCOL,
    host: 'github.com',
    hostname: 'github.com',
    pathname: `/${parsedUrl.hostname}${parsedUrl.pathname}`,
  }),
  'bitbucket:': parsedUrl => ({
    ...parsedUrl,
    slashes: true,
    auth: 'git',
    protocol: SSH_PROTOCOL,
    host: 'bitbucket.com',
    hostname: 'bitbucket.com',
    pathname: `/${parsedUrl.hostname}${parsedUrl.pathname}`,
  }),
});

export default class Git implements GitRefResolvingInterface {
  constructor(config: Config, gitUrl: GitUrl, hash: string) {
    this.supportsArchive = false;
    this.fetched = false;
    this.config = config;
    this.reporter = config.reporter;
    this.hash = hash;
    this.ref = hash;
    this.gitUrl = gitUrl;
    this.cwd = this.config.getTemp(crypto.hash(this.gitUrl.repository));
  }

  supportsArchive: boolean;
  fetched: boolean;
  config: Config;
  reporter: Reporter;
  hash: string;
  ref: string;
  cwd: string;
  gitUrl: GitUrl;

  /**
   * npm URLs contain a 'git+' scheme prefix, which is not understood by git.
   * git "URLs" also allow an alternative scp-like syntax, so they're not standard URLs.
   */
  static npmUrlToGitUrl(npmUrl: string): GitUrl {
    npmUrl = removePrefix(npmUrl, GIT_PROTOCOL_PREFIX);

    let parsed = url.parse(npmUrl);
    const expander = parsed.protocol && SHORTHAND_SERVICES[parsed.protocol];

    if (expander) {
      parsed = expander(parsed);
    }

    // Special case in npm, where ssh:// prefix is stripped to pass scp-like syntax
    // which in git works as remote path only if there are no slashes before ':'.
    // See #3146.
    if (
      parsed.protocol === SSH_PROTOCOL &&
      parsed.hostname &&
      parsed.path &&
      parsed.path.startsWith(SCP_PATH_PREFIX) &&
      parsed.port === null
    ) {
      const auth = parsed.auth ? parsed.auth + '@' : '';
      const pathname = parsed.path.slice(SCP_PATH_PREFIX.length);
      return {
        hostname: parsed.hostname,
        protocol: parsed.protocol,
        repository: `${auth}${parsed.hostname}:${pathname}`,
      };
    }

    // git local repos are specified as `git+file:` and a filesystem path, not a url.
    let repository;
    if (parsed.protocol === FILE_PROTOCOL) {
      repository = parsed.path;
    } else {
      repository = url.format({...parsed, hash: ''});
    }

    return {
      hostname: parsed.hostname || null,
      protocol: parsed.protocol || FILE_PROTOCOL,
      repository: repository || '',
    };
  }

  /**
   * Check if the host specified in the input `gitUrl` has archive capability.
   */

  static async hasArchiveCapability(ref: GitUrl): Promise<boolean> {
    const hostname = ref.hostname;
    if (ref.protocol !== 'ssh:' || hostname == null) {
      return false;
    }

    if (hostname in supportsArchiveCache) {
      return supportsArchiveCache[hostname];
    }

    try {
      await spawnGit(['archive', `--remote=${ref.repository}`, 'HEAD', Date.now() + '']);
      throw new Error();
    } catch (err) {
      handleSpawnError(err);
      const supports = err.message.indexOf('did not match any files') >= 0;
      return (supportsArchiveCache[hostname] = supports);
    }
  }

  /**
   * Check if the input `target` is a 5-40 character hex commit hash.
   */

  static async repoExists(ref: GitUrl): Promise<boolean> {
    const isLocal = ref.protocol === FILE_PROTOCOL;

    try {
      if (isLocal) {
        await spawnGit(['show-ref', '-t'], {cwd: ref.repository});
      } else {
        await spawnGit(['ls-remote', '-t', ref.repository]);
      }
      return true;
    } catch (err) {
      handleSpawnError(err);
      return false;
    }
  }

  static replaceProtocol(ref: GitUrl, protocol: string): GitUrl {
    return {
      hostname: ref.hostname,
      protocol,
      repository: ref.repository.replace(/^(?:git|http):/, protocol),
    };
  }

  /**
   * Attempt to upgrade insecure protocols to secure protocol
   */
  static async secureGitUrl(ref: GitUrl, hash: string, reporter: Reporter): Promise<GitUrl> {
    if (isCommitSha(hash)) {
      // this is cryptographically secure
      return ref;
    }

    if (ref.protocol === 'git:') {
      const secureUrl = Git.replaceProtocol(ref, 'https:');
      if (await Git.repoExists(secureUrl)) {
        return secureUrl;
      } else {
        reporter.warn(reporter.lang('downloadGitWithoutCommit', ref.repository));
        return ref;
      }
    }

    if (ref.protocol === 'http:') {
      const secureRef = Git.replaceProtocol(ref, 'https:');
      if (await Git.repoExists(secureRef)) {
        return secureRef;
      } else {
        reporter.warn(reporter.lang('downloadHTTPWithoutCommit', ref.repository));
        return ref;
      }
    }

    return ref;
  }

  /**
   * Archive a repo to destination
   */

  archive(dest: string): Promise<string> {
    if (this.supportsArchive) {
      return this._archiveViaRemoteArchive(dest);
    } else {
      return this._archiveViaLocalFetched(dest);
    }
  }

  async _archiveViaRemoteArchive(dest: string): Promise<string> {
    const hashStream = new crypto.HashStream();
    await spawnGit(['archive', `--remote=${this.gitUrl.repository}`, this.ref], {
      process(proc, resolve, reject, done) {
        const writeStream = createWriteStream(dest);
        proc.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('end', done);
        writeStream.on('open', function() {
          proc.stdout.pipe(hashStream).pipe(writeStream);
        });
        writeStream.once('finish', done);
      },
    });
    return hashStream.getHash();
  }

  async _archiveViaLocalFetched(dest: string): Promise<string> {
    const hashStream = new crypto.HashStream();
    await spawnGit(['archive', this.hash], {
      cwd: this.cwd,
      process(proc, resolve, reject, done) {
        const writeStream = createWriteStream(dest);
        proc.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('open', function() {
          proc.stdout.pipe(hashStream).pipe(writeStream);
        });
        writeStream.once('finish', done);
      },
    });
    return hashStream.getHash();
  }

  /**
   * Clone a repo to the input `dest`. Use `git archive` if it's available, otherwise fall
   * back to `git clone`.
   */

  clone(dest: string): Promise<void> {
    if (this.supportsArchive) {
      return this._cloneViaRemoteArchive(dest);
    } else {
      return this._cloneViaLocalFetched(dest);
    }
  }

  async _cloneViaRemoteArchive(dest: string): Promise<void> {
    await spawnGit(['archive', `--remote=${this.gitUrl.repository}`, this.ref], {
      process(proc, update, reject, done) {
        const extractor = tarFs.extract(dest, {
          dmode: 0o555, // all dirs should be readable
          fmode: 0o444, // all files should be readable
        });
        extractor.on('error', reject);
        extractor.on('finish', done);

        proc.stdout.pipe(extractor);
        proc.on('error', reject);
      },
    });
  }

  async _cloneViaLocalFetched(dest: string): Promise<void> {
    await spawnGit(['archive', this.hash], {
      cwd: this.cwd,
      process(proc, resolve, reject, done) {
        const extractor = tarFs.extract(dest, {
          dmode: 0o555, // all dirs should be readable
          fmode: 0o444, // all files should be readable
        });

        extractor.on('error', reject);
        extractor.on('finish', done);

        proc.stdout.pipe(extractor);
      },
    });
  }

  /**
   * Clone this repo.
   */

  fetch(): Promise<void> {
    const {gitUrl, cwd} = this;

    return fs.lockQueue.push(gitUrl.repository, async () => {
      if (await fs.exists(cwd)) {
        await spawnGit(['fetch', '--tags'], {cwd});
        await spawnGit(['pull'], {cwd});
      } else {
        await spawnGit(['clone', gitUrl.repository, cwd]);
      }

      this.fetched = true;
    });
  }

  /**
   * Fetch the file by cloning the repo and reading it.
   */

  getFile(filename: string): Promise<string | false> {
    if (this.supportsArchive) {
      return this._getFileFromArchive(filename);
    } else {
      return this._getFileFromClone(filename);
    }
  }

  async _getFileFromArchive(filename: string): Promise<string | false> {
    try {
      return await spawnGit(['archive', `--remote=${this.gitUrl.repository}`, this.ref, filename], {
        process(proc, update, reject, done) {
          const parser = tarStream.extract();

          parser.on('error', reject);
          parser.on('finish', done);

          parser.on('entry', (header, stream, next) => {
            const decoder = new StringDecoder('utf8');
            let fileContent = '';

            stream.on('data', buffer => {
              fileContent += decoder.write(buffer);
            });
            stream.on('end', () => {
              const remaining: string = decoder.end();
              update(fileContent + remaining);
              next();
            });
            stream.resume();
          });

          proc.stdout.pipe(parser);
        },
      });
    } catch (err) {
      if (err.message.indexOf('did not match any files') >= 0) {
        return false;
      } else {
        throw err;
      }
    }
  }

  async _getFileFromClone(filename: string): Promise<string | false> {
    invariant(this.fetched, 'Repo not fetched');

    try {
      return await spawnGit(['show', `${this.hash}:${filename}`], {
        cwd: this.cwd,
      });
    } catch (err) {
      handleSpawnError(err);
      // file doesn't exist
      return false;
    }
  }

  /**
   * Initialize the repo, find a secure url to use and
   * set the ref to match an input `target`.
   */
  async init(): Promise<string> {
    this.gitUrl = await Git.secureGitUrl(this.gitUrl, this.hash, this.reporter);

    await this.setRefRemote();

    // check capabilities
    if (this.ref !== '' && (await Git.hasArchiveCapability(this.gitUrl))) {
      this.supportsArchive = true;
    } else {
      await this.fetch();
    }

    return this.hash;
  }

  async setRefRemote(): Promise<string> {
    const isLocal = this.gitUrl.protocol === FILE_PROTOCOL;
    let stdout;

    if (isLocal) {
      stdout = await spawnGit(['show-ref', '--tags', '--heads'], {cwd: this.gitUrl.repository});
    } else {
      stdout = await spawnGit(['ls-remote', '--tags', '--heads', this.gitUrl.repository]);
    }

    const refs = parseRefs(stdout);
    return this.setRef(refs);
  }

  setRefHosted(hostedRefsList: string): Promise<string> {
    const refs = parseRefs(hostedRefsList);
    return this.setRef(refs);
  }

  /**
   * Resolves the default branch of a remote repository (not always "master")
   */

  async resolveDefaultBranch(): Promise<ResolvedSha> {
    const isLocal = this.gitUrl.protocol === FILE_PROTOCOL;

    try {
      let stdout;
      if (isLocal) {
        stdout = await spawnGit(['show-ref', 'HEAD'], {cwd: this.gitUrl.repository});
        const refs = parseRefs(stdout);
        const sha = refs.values().next().value;
        if (sha) {
          return {sha, ref: undefined};
        } else {
          throw new Error('Unable to find SHA for git HEAD');
        }
      } else {
        stdout = await spawnGit(['ls-remote', '--symref', this.gitUrl.repository, 'HEAD']);
        const lines = stdout.split('\n').filter(validRef);
        const [, ref] = lines[0].split(/\s+/);
        const [sha] = lines[1].split(/\s+/);
        return {sha, ref};
      }
    } catch (err) {
      handleSpawnError(err);
      // older versions of git don't support "--symref"
      const stdout = await spawnGit(['ls-remote', this.gitUrl.repository, 'HEAD']);
      const lines = stdout.split('\n').filter(validRef);
      const [sha] = lines[0].split(/\s+/);
      return {sha, ref: undefined};
    }
  }

  /**
   * Resolve a git commit to it's 40-chars format and ensure it exists in the repository
   * We need to use the 40-chars format to avoid multiple folders in the cache
   */

  async resolveCommit(shaToResolve: string): Promise<?ResolvedSha> {
    try {
      await this.fetch();
      const revListArgs = ['rev-list', '-n', '1', '--no-abbrev-commit', '--format=oneline', shaToResolve];
      const stdout = await spawnGit(revListArgs, {cwd: this.cwd});
      const [sha] = stdout.split(/\s+/);
      return {sha, ref: undefined};
    } catch (err) {
      handleSpawnError(err);
      // assuming commit not found, let's try something else
      return null;
    }
  }

  /**
   * Resolves the input hash / ref / semver range to a valid commit sha
   * If possible also resolves the sha to a valid ref in order to use "git archive"
   */

  async setRef(refs: GitRefs): Promise<string> {
    // get commit ref
    const {hash: version} = this;

    const resolvedResult = await resolveVersion({
      config: this.config,
      git: this,
      version,
      refs,
    });
    if (!resolvedResult) {
      throw new MessageError(
        this.reporter.lang('couldntFindMatch', version, Array.from(refs.keys()).join(','), this.gitUrl.repository),
      );
    }

    this.hash = resolvedResult.sha;
    this.ref = resolvedResult.ref || '';
    return this.hash;
  }
}
