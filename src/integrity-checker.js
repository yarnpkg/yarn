/* @flow */

import type Config from './config.js';
import {registryNames} from './registries/index.js';
import type {Manifest} from './types.js';
import * as crypto from './util/crypto.js';
import * as fs from './util/fs.js';
import {sortAlpha} from './util/misc.js';

const invariant = require('invariant');
const path = require('path');

export type IntegrityMatch = {
  actual: string,
  expected: string,
  loc: string,
  matches: boolean,
};
/**
 *
 */
export default class InstallationIntegrityChecker {
  constructor(config: Config) {
    this.config = config;
    this.files = [];

  }

  config: Config;

  files: Array<string>;

  /**
   * Get the location of an existing integrity hash. If none exists then return the location where we should
   * write a new one.
   */

  async getIntegrityHashLocation(): Promise<string> {
    // build up possible folders
    const possibleFolders = [];
    if (this.config.modulesFolder) {
      possibleFolders.push(this.config.modulesFolder);
    }

    // get a list of registry names to check existence in
    let checkRegistryNames = this.resolver.usedRegistries;
    if (!checkRegistryNames.length) {
      // we haven't used any registries yet
      checkRegistryNames = registryNames;
    }

    // ensure we only write to a registry folder that was used
    for (const name of checkRegistryNames) {
      const loc = path.join(this.config.cwd, this.config.registries[name].folder);
      possibleFolders.push(loc);
    }

    // if we already have an integrity hash in one of these folders then use it's location otherwise use the
    // first folder
    const possibles = possibleFolders.map((folder): string => path.join(folder, constants.INTEGRITY_FILENAME));
    let loc = possibles[0];
    for (const possibleLoc of possibles) {
      if (await fs.exists(possibleLoc)) {
        loc = possibleLoc;
        break;
      }
    }
    return loc;
  }
  /**
   * Write the integrity hash of the current install to disk.
   */

  async writeIntegrityHash(lockSource: string, patterns: Array<string>): Promise<void> {
    const loc = await this.getIntegrityHashLocation();
    invariant(loc, 'expected integrity hash location');
    await fs.mkdirp(path.dirname(loc));
    await fs.writeFile(loc, this.generateIntegrityHash(lockSource, patterns));
  }

  /**
   * Generate integrity hash of input lockfile.
   */

  generateIntegrityHash(lockfile: string, patterns: Array<string>): string {
    const opts = [lockfile];

    opts.push(`patterns:${patterns.sort(sortAlpha).join(',')}`);

    if (this.flags.flat) {
      opts.push('flat');
    }

    if (this.config.production) {
      opts.push('production');
    }

    const linkedModules = this.config.linkedModules;
    if (linkedModules.length) {
      opts.push(`linked:${linkedModules.join(',')}`);
    }

    const mirror = this.config.getOfflineMirrorPath();
    if (mirror != null) {
      opts.push(`mirror:${mirror}`);
    }

    return crypto.hash(opts.join('-'), 'sha256');
  }

  /**
   * Check if the integrity hash of this installation matches one on disk.
   */

  async matchesIntegrityHash(patterns: Array<string>): Promise<IntegrityMatch> {
    const loc = await this.getIntegrityHashLocation();
    if (!await fs.exists(loc)) {
      return {
        actual: '',
        expected: '',
        loc,
        matches: false,
      };
    }

    const lockSource = lockStringify(this.lockfile.getLockfile(this.resolver.patterns));
    const actual = this.generateIntegrityHash(lockSource, patterns);
    const expected = (await fs.readFile(loc)).trim();

    return {
      actual,
      expected,
      loc,
      matches: actual === expected,
    };
  }

  check(): Promise<boolean> {
    // read integrity file
    // check if core files exist
    // check hash code is the same
  }

  save(): Promise<void> {
    // read files in node_modules
    // generate hash
    // save integrity file
  }

  // TODO consider optimizations
  // TODO provide API for post install hook???

  async removeIntegrityFile(): Promise<void> {
    const loc = this.getIntegrityHashLocation();
    await fs.unlink(loc);
  }

  init(): void {
  }
}
