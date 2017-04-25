/* @flow */

import type Config from './config.js';
import type {LockManifest} from './lockfile/wrapper.js';
import type {RegistryNames} from './registries/index.js';
import type {Reporter} from './reporters/index.js';
import * as constants from './constants.js';
import {registryNames} from './registries/index.js';
import * as fs from './util/fs.js';
import {sortAlpha, compareSortedArrays} from './util/misc.js';
import type {InstallArtifacts} from './package-install-scripts.js';

const invariant = require('invariant');
const path = require('path');

export type IntegrityCheckResult = {
  integrityFileMissing: boolean,
  integrityMatches?: boolean,
  missingPatterns: Array<string>,
};

type IntegrityHashLocation = {
  locationFolder: string,
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
  artifacts: ?InstallArtifacts,
}

type IntegrityFlags = {
  flat: boolean,
  checkFiles: boolean,
}

/**
 *
 */
export default class InstallationIntegrityChecker {
  constructor(
    config: Config,
    reporter: Reporter,
  ) {
    this.config = config;
    this.reporter = reporter;
  }

  config: Config;
  reporter: Reporter;


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
    let loc;
    for (const possibleLoc of possibleFolders) {
      if (await fs.exists(path.join(possibleLoc, constants.INTEGRITY_FILENAME))) {
        loc = possibleLoc;
        break;
      }
    }
    const locationFolder = loc || possibleFolders[0];
    const locationPath = path.join(locationFolder, constants.INTEGRITY_FILENAME);
    return {
      locationFolder,
      locationPath,
      exists: !!loc,
    };
  }

  /**
   * returns a list of files recursively in a directory sorted
   */
  async _getFilesDeep(rootDir: string): Promise<Array<string>> {
    async function getFilePaths(rootDir: string, files: Array<string>, currentDir: string = rootDir): Promise<void> {
      for (const file of await fs.readdir(currentDir)) {
        const entry = path.join(currentDir, file);
        const stat = await fs.stat(entry);
        if (stat.isDirectory()) {
          await getFilePaths(rootDir, files, entry);
        } else {
          files.push(path.relative(rootDir, entry));
        }
      }
    }
    const result = [];
    await getFilePaths(rootDir, result);
    return result;
  }

  /**
   * Generate integrity hash of input lockfile.
   */

  async _generateIntegrityFile(
    lockfile: {[key: string]: LockManifest},
    patterns: Array<string>,
    flags: IntegrityFlags,
    modulesFolder: string,
    artifacts?: InstallArtifacts,
  ): Promise<IntegrityFile> {

    const result: IntegrityFile = {
      flags: [],
      linkedModules: [],
      topLevelPatters: [],
      lockfileEntries: {},
      files: [],
      artifacts,
    };

    result.topLevelPatters = patterns.sort(sortAlpha);

    if (flags.flat) {
      result.flags.push('flat');
    }
    if (flags.ignoreScripts) {
      result.flags.push('ignoreScripts');
    }

    if (this.config.production) {
      result.flags.push('production');
    }

    const linkedModules = this.config.linkedModules;
    if (linkedModules.length) {
      result.linkedModules = linkedModules.sort(sortAlpha);
    }

    Object.keys(lockfile).forEach((key) => {
      result.lockfileEntries[key] = lockfile[key].resolved;
    });

    if (flags.checkFiles) {
      result.files = await this._getFilesDeep(modulesFolder);
    }

    return result;
  }

  _compareIntegrityFiles(actual: IntegrityFile, expected: IntegrityFile): boolean {
    if (!compareSortedArrays(actual.linkedModules, expected.linkedModules)) {
      this.reporter.warn(this.reporter.lang('integrityCheckLinkedModulesDontMatch'));
      return false;
    }
    if (!compareSortedArrays(actual.topLevelPatters, expected.topLevelPatters)) {
      this.reporter.warn(this.reporter.lang('integrityPatternsDontMatch'));
      return false;
    }
    if (!compareSortedArrays(actual.flags, expected.flags)) {
      this.reporter.warn(this.reporter.lang('integrityFlagsDontMatch'));
      return false;
    }
    for (const key of Object.keys(actual.lockfileEntries)) {
      if (actual.lockfileEntries[key] !== expected.lockfileEntries[key]) {
        this.reporter.warn(this.reporter.lang('integrityLockfilesDontMatch'));
        return false;
      }
    }
    for (const key of Object.keys(expected.lockfileEntries)) {
      if (actual.lockfileEntries[key] !== expected.lockfileEntries[key]) {
        this.reporter.warn(this.reporter.lang('integrityLockfilesDontMatch'));
        return false;
      }
    }
    return true;
  }

  async check(
    patterns: Array<string>,
    lockfile: {[key: string]: LockManifest},
    flags: IntegrityFlags): Promise<IntegrityCheckResult> {
    // check if patterns exist in lockfile
    const missingPatterns = patterns.filter((p) => !lockfile[p]);
    const loc = await this._getIntegrityHashLocation();
    if (missingPatterns.length || !loc.exists) {
      return {
        integrityFileMissing: !loc.exists,
        missingPatterns,
      };
    }

    const actual = await this._generateIntegrityFile(
      lockfile,
      patterns,
      Object.assign({}, {checkFiles: false}, flags), // don't generate files when checking, we check the files below
      loc.locationFolder);
    const expectedRaw = await fs.readFile(loc.locationPath);
    let expected: ?IntegrityFile;
    try {
      expected = JSON.parse(expectedRaw);
    } catch (e) {
      // ignore JSON parsing for legacy text integrity files compatibility
    }
    let integrityMatches;
    if (expected) {
      integrityMatches = this._compareIntegrityFiles(actual, expected);
      if (flags.checkFiles && expected.files.length === 0) {
        // edge case handling - --check-fies is passed but .yarn-integrity does not contain any files
        // check and fail if there are file in node_modules after all.
        const actualFiles = await this._getFilesDeep(loc.locationFolder);
        if (actualFiles.length > 0) {
          this.reporter.warn(this.reporter.lang('integrityFailedFilesMissing'));
          integrityMatches = false;
        }
      } else if (flags.checkFiles && expected.files.length > 0) {
        // TODO we may want to optimise this check by checking only for package.json files on very large trees
        for (const file of expected.files) {
          if (!await fs.exists(path.join(loc.locationFolder, file))) {
            this.reporter.warn(this.reporter.lang('integrityFailedFilesMissing'));
            integrityMatches = false;
            break;
          }
        }
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
   * Get artifacts from integrity file if it exists.
   */
  async getArtifacts(): Promise<?InstallArtifacts> {
    const loc = await this._getIntegrityHashLocation();
    if (!loc.exists) {
      return null;
    }

    const expectedRaw = await fs.readFile(loc.locationPath);
    let expected: ?IntegrityFile;
    try {
      expected = JSON.parse(expectedRaw);
    } catch (e) {
      // ignore JSON parsing for legacy text integrity files compatibility
    }

    return expected ? expected.artifacts : null;
  }

  /**
   * Write the integrity hash of the current install to disk.
   */
  async save(
    patterns: Array<string>,
    lockfile: {[key: string]: LockManifest},
    flags: IntegrityFlags,
    usedRegistries?: Set<RegistryNames>,
    artifacts: InstallArtifacts): Promise<void> {
    const loc = await this._getIntegrityHashLocation(usedRegistries);
    invariant(loc.locationPath, 'expected integrity hash location');
    await fs.mkdirp(path.dirname(loc.locationPath));
    const integrityFile = await this._generateIntegrityFile(lockfile, patterns, flags, loc.locationFolder, artifacts);
    await fs.writeFile(loc.locationPath, JSON.stringify(integrityFile, null, 2));
  }

  async removeIntegrityFile(): Promise<void> {
    const loc = await this._getIntegrityHashLocation();
    if (loc.exists) {
      await fs.unlink(loc.locationPath);
    }
  }

}
