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
  [name: string]: string
};

const supportsArchiveCache: { [key: string]: ?boolean } = map({
  'github.com': false, // not support, doubt they will ever support it
});

export default class Git {
  constructor(config: Config, url: string, hash: string) {
    this.supportsArchive = false;
    this.fetched = false;
    this.config = config;
    this.reporter = config.reporter;
    this.hash = hash;
    this.ref = hash;
    this.url = Git.cleanUrl(url);
    this.cwd = this.config.getTemp(crypto.hash(this.url));
  }

  supportsArchive: boolean;
  fetched: boolean;
  config: Config;
  reporter: Reporter;
  hash: string;
  ref: string;
  cwd: string;
  url: string;


  static cleanUrl(url): string {
    return url.replace(/^git\+/, '');
  }

  /**
   * Check if the host specified in the input `gitUrl` has archive capability.
   */

  static async hasArchiveCapability(gitUrl: string): Promise<boolean> {
    // USER@HOSTNAME:PATHNAME
    const match = gitUrl.match(/^(.*?)@(.*?):(.*?)$/);
    if (!match) {
      return false;
    }

    const [,, hostname] = match;
    const cached = supportsArchiveCache[hostname];
    if (cached != null) {
      return cached;
    }

    try {
      await child.spawn('git', ['archive', `--remote=${gitUrl}`, 'HEAD', Date.now() + '']);
      throw new Error();
    } catch (err) {
      const supports = err.message.indexOf('did not match any files') >= 0;
      return supportsArchiveCache[hostname] = supports;
    }
  }

  /**
   * Check if the input `target` is a 5-40 character hex commit hash.
   */

  static isCommitHash(target: string): boolean {
    return !!target && /^[a-f0-9]{5,40}$/.test(target);
  }

  static async repoExists(gitUrl: string): Promise<boolean> {
    try {
      await child.spawn('git', ['ls-remote', '-t', gitUrl]);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Attempt to upgrade insecure protocols to secure protocol
   */

  static async secureUrl(ref: string, hash: string, reporter: Reporter): Promise<string> {
    if (Git.isCommitHash(hash)) {
      // this is cryptographically secure
      return ref;
    }

    const parts = url.parse(ref);

    if (parts.protocol === 'git:') {
      const secureUrl = ref.replace(/^git:/, 'https:');
      if (await Git.repoExists(secureUrl)) {
        return secureUrl;
      } else {
        throw new SecurityError(
          reporter.lang('refusingDownloadGitWithoutCommit', ref),
        );
      }
    }

    if (parts.protocol === 'http:') {
      const secureUrl = ref.replace(/^http:/, 'https:');
      if (await Git.repoExists(secureUrl)) {
        return secureUrl;
      } else {
        if (await Git.repoExists(ref)) {
          return ref;
        } else {
          throw new SecurityError(
            reporter.lang('refusingDownloadHTTPWithoutCommit', ref),
          );
        }
      }
    }

    if (parts.protocol === 'https:') {
      if (await Git.repoExists(ref)) {
        return ref;
      } else {
        throw new SecurityError(
          reporter.lang('refusingDownloadHTTPSWithoutCommit', ref),
        );
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
    await child.spawn('git', ['archive', `--remote=${this.url}`, this.ref], {
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
    await child.spawn('git', ['archive', this.hash], {
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
    await child.spawn('git', ['archive', `--remote=${this.url}`, this.ref], {
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
    await child.spawn('git', ['archive', this.hash], {
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
    const {url, cwd} = this;

    return fs.lockQueue.push(url, async () => {
      if (await fs.exists(cwd)) {
        await child.spawn('git', ['pull'], {cwd});
      } else {
        await child.spawn('git', ['clone', url, cwd]);
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

    return await this.config.resolveConstraints(
      tags.filter((tag): boolean => !!semver.valid(tag, this.config.looseSemver)),
      range,
    ) || range;
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
      return await child.spawn('git', ['archive', `--remote=${this.url}`, this.ref, filename], {
        process(proc, update, reject, done) {
          const parser = tarStream.extract();

          parser.on('error', reject);
          parser.on('finish', done);

          parser.on('entry', (header, stream, next) => {
            const decoder = new StringDecoder('utf8');
            let fileContent = '';

            stream.on('data', (buffer) => {
              fileContent += decoder.write(buffer);
            });
            stream.on('end', () => {
              // $FlowFixMe: suppressing this error due to bug https://github.com/facebook/flow/pull/3483
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
      return await child.spawn('git', ['show', `${this.hash}:${filename}`], {cwd: this.cwd});
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
    this.url = await Git.secureUrl(this.url, this.hash, this.reporter);
    // check capabilities
    if (await Git.hasArchiveCapability(this.url)) {
      this.supportsArchive = true;
    } else {
      await this.fetch();
    }

    return await this.setRefRemote();
  }

  async setRefRemote(): Promise<string> {
    const stdout = await child.spawn('git', ['ls-remote', '-q', '--tags', '--heads', this.url], 
    {env: {GIT_SSH_COMMAND:'ssh -q'}});
    const refs = Git.parseRefs(stdout);
    return await this.setRef(refs);
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
      return this.ref = this.hash = hash;
    }

    const ref = await this.findResolution(hash, names);
    const commit = refs[ref];
    if (commit) {
      this.ref = ref;
      return this.hash = commit;
    } else {
      throw new MessageError(this.reporter.lang('couldntFindMatch', ref, names.join(','), this.url));
    }
  }

  /**
   * TODO description
   */

  static parseRefs(stdout: string): GitRefs {
    // store references
    const refs = {};

    // line delimited
    const refLines = stdout.split('\n');

    for (const line of refLines) {
      // line example: 64b2c0cee9e829f73c5ad32b8cc8cb6f3bec65bb refs/tags/v4.2.2
      const [sha, id] = line.split(/\s+/g);
      let name = id.split('/').slice(2).join('/');

      // TODO: find out why this is necessary. idk it makes it work...
      name = removeSuffix(name, '^{}');

      refs[name] = sha;
    }

    return refs;
  }
}
