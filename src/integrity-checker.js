/* @flow */

import type Config from './config.js';
import type {RegistryNames} from './registries/index.js';
import * as constants from './constants.js';
import {registryNames} from './registries/index.js';
import Lockfile from './lockfile/wrapper.js';
import * as fs from './util/fs.js';
import {sortAlpha, compareSortedArrays} from './util/misc.js';


const invariant = require('invariant');
const path = require('path');

export type IntegrityCheckResult = {
  integrityFileMissing: boolean,
  integrityMatches?: boolean,
  missingPatterns: Array<string>,
};

type IntegrityHashLocation = {
  locationPath: string,
  exists: boolean,
}

type IntegrityFile = {
  flags: Array<string>,
  linkedModules: Array<string>,
  topLevelPatters: Array<string>,
  lockfileEntries: {
    [key: string]: string
  },
  files: Array<string>,
}

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

  async _getIntegrityHashLocation(usedRegistries?: Set<RegistryNames>): Promise<IntegrityHashLocation> {
    // build up possible folders
    let registries = registryNames;
    if (usedRegistries && usedRegistries.size > 0) {
      registries = usedRegistries;
    }
    const possibleFolders = [];
    if (this.config.modulesFolder) {
      possibleFolders.push(this.config.modulesFolder);
    }

    // ensure we only write to a registry folder that was used
    for (const name of registries) {
      const loc = path.join(this.config.cwd, this.config.registries[name].folder);
      possibleFolders.push(loc);
    }

    // if we already have an integrity hash in one of these folders then use it's location otherwise use the
    // first folder
    const possibles = possibleFolders.map((folder): string => path.join(folder, constants.INTEGRITY_FILENAME));
    let loc;
    for (const possibleLoc of possibles) {
      if (await fs.exists(possibleLoc)) {
        loc = possibleLoc;
        break;
      }
    }
    return {
      locationPath: loc || possibles[0],
      exists: !!loc,
    };
  }

  /**
   * Generate integrity hash of input lockfile.
   */

  _generateIntegrityFile(lockfile: Lockfile, patterns: Array<string>, flags: Object): IntegrityFile {

    const result: IntegrityFile = {
      flags: [],
      linkedModules: [],
      topLevelPatters: [],
      lockfileEntries: {},
      files: [],
    };

    result.topLevelPatters = patterns.sort(sortAlpha);

    if (flags.flat) {
      result.flags.push('flat');
    }

    if (this.config.production) {
      result.flags.push('production');
    }

    const linkedModules = this.config.linkedModules;
    if (linkedModules.length) {
      result.linkedModules = linkedModules.sort(sortAlpha);
    }

    const lockCache = lockfile.cache;
    if (lockCache) {
      Object.keys(lockCache).forEach((key) => {
        const manifest = lockfile.getLocked(key);
        if (manifest) {
          result.lockfileEntries[key] = manifest.resolved;
        }
      });
    }

    // TODO files array

    return result;
  }

  _compareIntegrityFiles(actual: IntegrityFile, expected: IntegrityFile): boolean {
    if (!compareSortedArrays(actual.linkedModules, expected.linkedModules)) {
      return false;
    }
    if (!compareSortedArrays(actual.topLevelPatters, expected.topLevelPatters)) {
      return false;
    }
    if (!compareSortedArrays(actual.flags, expected.flags)) {
      return false;
    }
    for (const key of Object.keys(actual.lockfileEntries)) {
      if (actual.lockfileEntries[key] !== expected.lockfileEntries[key]) {
        return false;
      }
    }
    for (const key of Object.keys(expected.lockfileEntries)) {
      if (actual.lockfileEntries[key] !== expected.lockfileEntries[key]) {
        return false;
      }
    }
    return true;
  }

  async check(
    patterns: Array<string>,
    lockfile: Lockfile,
    flags: Object): Promise<IntegrityCheckResult> {
    // check if patterns exist in lockfile
    const missingPatterns = patterns.filter((p) => !lockfile.getLocked(p));
    const loc = await this._getIntegrityHashLocation();
    if (missingPatterns.length || !loc.exists) {
      return {
        integrityFileMissing: !loc.exists,
        missingPatterns,
      };
    }

    const actual = this._generateIntegrityFile(lockfile, patterns, flags);
    const expectedRaw = await fs.readFile(loc.locationPath);
    let expected: IntegrityFile;
    try {
      expected = JSON.parse(expectedRaw);
    } catch (e) {
      // ignore JSON parsing for legacy text integrity files compatibility
    }
    let integrityMatches;
    if (expected) {
      integrityMatches = this._compareIntegrityFiles(actual, expected);
      // TODO check files presency
      if (expected.files.length > 0) {
        integrityMatches = true;
      }
    } else {
      integrityMatches = false;
    }

    return {
      integrityFileMissing: false,
      integrityMatches,
      missingPatterns,
    };
  }

  /**
   * Write the integrity hash of the current install to disk.
   */
  async save(
    patterns: Array<string>,
    lockfile: Lockfile,
    flags: Object,
    usedRegistries?: Set<RegistryNames>): Promise<void> {
    const loc = await this._getIntegrityHashLocation(usedRegistries);
    invariant(loc.locationPath, 'expected integrity hash location');
    await fs.mkdirp(path.dirname(loc.locationPath));
    const integrityFileContent = JSON.stringify(this._generateIntegrityFile(lockfile, patterns, flags), null, 2);
    await fs.writeFile(loc.locationPath, integrityFileContent);
  }

  async removeIntegrityFile(): Promise<void> {
    const loc = await this._getIntegrityHashLocation();
    if (loc.exists) {
      await fs.unlink(loc.locationPath);
    }
  }

}
