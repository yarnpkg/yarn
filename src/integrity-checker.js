/* @flow */

import type Config from './config.js';
import * as constants from './constants.js';
import {registryNames} from './registries/index.js';
import Lockfile from './lockfile/wrapper.js';
import * as crypto from './util/crypto.js';
import * as fs from './util/fs.js';
import {sortAlpha} from './util/misc.js';


const invariant = require('invariant');
const path = require('path');

export type IntegrityCheckResult = {
  integrityFileMissing: boolean,
  integrityHashMatches?: boolean,
  missingPatterns: Array<string>,
};

/**
 *
 */
export default class InstallationIntegrityChecker {
  constructor(config: Config) {
    this.config = config;
  }

  config: Config;

  /**
   * Get the location of an existing integrity hash. If none exists then return the location where we should
   * write a new one.
   */

  async _getIntegrityHashLocation(): Promise<string> {
    // build up possible folders
    const possibleFolders = [];
    if (this.config.modulesFolder) {
      possibleFolders.push(this.config.modulesFolder);
    }

    // ensure we only write to a registry folder that was used
    for (const name of registryNames) {
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
   * Generate integrity hash of input lockfile.
   */

  _generateIntegrityHash(lockfile: string, patterns: Array<string>, flags: Object): string {
    const opts = [lockfile];

    opts.push(`patterns:${patterns.sort(sortAlpha).join(',')}`);

    if (flags.flat) {
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

  async check(
    patterns: Array<string>,
    lockfile: Lockfile,
    normalizedLockSource: string,
    flags: Object): Promise<IntegrityCheckResult> {
    // check if patterns exist in lockfile
    const missingPatterns = patterns.filter((p) => !lockfile.getLocked(p));
    const loc = await this._getIntegrityHashLocation();
    const integrityFileMissing = !await fs.exists(loc);
    if (missingPatterns.length || integrityFileMissing) {
      return {
        integrityFileMissing,
        missingPatterns,
      };
    }

    const actual = this._generateIntegrityHash(normalizedLockSource, patterns, flags);
    const expected = (await fs.readFile(loc)).trim();

    return {
      integrityFileMissing,
      integrityHashMatches: actual === expected,
      missingPatterns,
    };
  }

  /**
   * Write the integrity hash of the current install to disk.
   */
  async save(patterns: Array<string>, normalizedLockSource: string, flags: Object): Promise<void> {
    const loc = await this._getIntegrityHashLocation();
    invariant(loc, 'expected integrity hash location');
    await fs.mkdirp(path.dirname(loc));
    await fs.writeFile(loc, this._generateIntegrityHash(normalizedLockSource, patterns, flags));
  }

  async removeIntegrityFile(): Promise<void> {
    const loc = await this._getIntegrityHashLocation();
    await fs.unlink(loc);
  }

}
