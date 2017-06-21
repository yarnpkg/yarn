/* @flow */

import type Config from '../config.js';
import type {Reporter} from '../reporters/index.js';
import {MessageError, SecurityError} from '../errors.js';
import {removeSuffix} from './misc.js';
import * as crypto from './crypto.js';
import * as child from './child.js';
import * as fs from './fs.js';
import map from './map.js';

const invariant = require('invariant');
const semver = require('semver');
const StringDecoder = require('string_decoder').StringDecoder;
const tarFs = require('tar-fs');
const tarStream = require('tar-stream');
const url = require('url');
import {createWriteStream} from 'fs';

type GitRefs = {
  [name: string]: string,
};

type GitUrl = {
  protocol: string, // parsed from URL
  hostname: ?string,
  repository: string, // git-specific "URL"
};

const supportsArchiveCache: {[key: string]: boolean} = map({
  'github.com': false, // not support, doubt they will ever support it
});

// Suppress any password prompts since we run these in the background
const env = {GIT_ASKPASS: '', GIT_TERMINAL_PROMPT: 0, GIT_SSH_COMMAND: 'ssh -oBatchMode=yes'};

// This regex is designed to match output from git of the style:
//   ebeb6eafceb61dd08441ffe086c77eb472842494  refs/tags/v0.21.0
// and extract the hash and tag name as capture groups
const gitRefLineRegex = /^([a-fA-F0-9]+)\s+(?:[^/]+\/){2}(.*)$/;

export default class Git {
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
    // Expand shortened format first if needed
    npmUrl = npmUrl.replace(/^github:/, 'git+ssh://git@github.com/');

    // Special case in npm, where ssh:// prefix is stripped to pass scp-like syntax
    // which in git works as remote path only if there are no slashes before ':'.
    const match = npmUrl.match(/^git\+ssh:\/\/((?:[^@:\/]+@)?([^@:\/]+):([^/]*).*)/);
    // Additionally, if the host part is digits-only, npm falls back to
    // interpreting it as an SSH URL with a port number.
    if (match && /[^0-9]/.test(match[3])) {
      return {
        hostname: match[2],
        protocol: 'ssh:',
        repository: match[1],
      };
    }

    const repository = npmUrl.replace(/^git\+/, '');
    const parsed = url.parse(repository);
    return {
      hostname: parsed.hostname || null,
      protocol: parsed.protocol || 'file:',
      repository,
    };
  }

  static spawn(args: Array<string>, opts?: child_process$spawnOpts = {}): Promise<string> {
    return child.spawn('git', args, {...opts, env});
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
      await Git.spawn(['archive', `--remote=${ref.repository}`, 'HEAD', Date.now() + '']);
      throw new Error();
    } catch (err) {
      const supports = err.message.indexOf('did not match any files') >= 0;
      return (supportsArchiveCache[hostname] = supports);
    }
  }

  /**
   * Check if the input `target` is a 5-40 character hex commit hash.
   */

  static isCommitHash(target: string): boolean {
    return !!target && /^[a-f0-9]{5,40}$/.test(target);
  }

  static async repoExists(ref: GitUrl): Promise<boolean> {
    try {
      await Git.spawn(['ls-remote', '-t', ref.repository]);
      return true;
    } catch (err) {
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
    if (Git.isCommitHash(hash)) {
      // this is cryptographically secure
      return ref;
    }

    if (ref.protocol === 'git:') {
      const secureUrl = Git.replaceProtocol(ref, 'https:');
      if (await Git.repoExists(secureUrl)) {
        return secureUrl;
      } else {
        throw new SecurityError(reporter.lang('refusingDownloadGitWithoutCommit', ref));
      }
    }

    if (ref.protocol === 'http:') {
      const secureRef = Git.replaceProtocol(ref, 'https:');
      if (await Git.repoExists(secureRef)) {
        return secureRef;
      } else {
        if (await Git.repoExists(ref)) {
          return ref;
        } else {
          throw new SecurityError(reporter.lang('refusingDownloadHTTPWithoutCommit', ref));
        }
      }
    }

    if (ref.protocol === 'https:') {
      if (await Git.repoExists(ref)) {
        return ref;
      } else {
        throw new SecurityError(reporter.lang('refusingDownloadHTTPSWithoutCommit', ref));
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
    await Git.spawn(['archive', `--remote=${this.gitUrl.repository}`, this.ref], {
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
    await Git.spawn(['archive', this.hash], {
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
    await Git.spawn(['archive', `--remote=${this.gitUrl.repository}`, this.ref], {
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
    await Git.spawn(['archive', this.hash], {
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
        await Git.spawn(['pull'], {cwd});
      } else {
        await Git.spawn(['clone', gitUrl.repository, cwd]);
      }

      this.fetched = true;
    });
  }

  /**
   * Given a list of tags/branches from git, check if they match an input range.
   */

  async findResolution(range: ?string, tags: Array<string>): Promise<string> {
    // If there are no tags and target is *, fallback to the latest commit on master
    // or if we have no target.
    if (!range || (!tags.length && range === '*')) {
      return 'master';
    }

    return (
      (await this.config.resolveConstraints(
        tags.filter((tag): boolean => !!semver.valid(tag, this.config.looseSemver)),
        range,
      )) || range
    );
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
      return await Git.spawn(['archive', `--remote=${this.gitUrl.repository}`, this.ref, filename], {
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
      return await Git.spawn(['show', `${this.hash}:${filename}`], {
        cwd: this.cwd,
      });
    } catch (err) {
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
    // check capabilities
    if (await Git.hasArchiveCapability(this.gitUrl)) {
      this.supportsArchive = true;
    } else {
      await this.fetch();
    }

    return this.setRefRemote();
  }

  async setRefRemote(): Promise<string> {
    const stdout = await Git.spawn(['ls-remote', '--tags', '--heads', this.gitUrl.repository]);
    const refs = Git.parseRefs(stdout);
    return this.setRef(refs);
  }

  /**
   * TODO description
   */

  async setRef(refs: GitRefs): Promise<string> {
    // get commit ref
    const {hash} = this;

    const names = Object.keys(refs);

    if (Git.isCommitHash(hash)) {
      for (const name in refs) {
        if (refs[name] === hash) {
          this.ref = name;
          return hash;
        }
      }

      // `git archive` only accepts a treeish and we have no ref to this commit
      this.supportsArchive = false;

      if (!this.fetched) {
        // in fact, `git archive` can't be used, and we haven't fetched the project yet. Do it now.
        await this.fetch();
      }
      return (this.ref = this.hash = hash);
    }

    const ref = await this.findResolution(hash, names);
    const commit = refs[ref];
    if (commit) {
      this.ref = ref;
      return (this.hash = commit);
    } else {
      throw new MessageError(this.reporter.lang('couldntFindMatch', ref, names.join(','), this.gitUrl.repository));
    }
  }

  /**
   * Parse Git ref lines into hash of tag names to SHA hashes
   */

  static parseRefs(stdout: string): GitRefs {
    // store references
    const refs = {};

    // line delimited
    const refLines = stdout.split('\n');

    for (const line of refLines) {
      const match = gitRefLineRegex.exec(line);

      if (match) {
        const [, sha, tagName] = match;

        // As documented in gitrevisions:
        //   https://www.kernel.org/pub/software/scm/git/docs/gitrevisions.html#_specifying_revisions
        // "A suffix ^ followed by an empty brace pair means the object could be a tag,
        //   and dereference the tag recursively until a non-tag object is found."
        // In other words, the hash without ^{} is the hash of the tag,
        //   and the hash with ^{} is the hash of the commit at which the tag was made.
        const name = removeSuffix(tagName, '^{}');

        refs[name] = sha;
      }
    }

    return refs;
  }
}
