/* @flow */

import type Config from './config.js';
import type {LockManifest} from './lockfile/wrapper.js';
import type {RegistryNames} from './registries/index.js';
import * as constants from './constants.js';
import {registryNames} from './registries/index.js';
import * as fs from './util/fs.js';
import {sortAlpha, compareSortedArrays} from './util/misc.js';
import type {InstallArtifacts} from './package-install-scripts.js';
import WorkspaceLayout from './workspace-layout.js';

const invariant = require('invariant');
const path = require('path');

export const integrityErrors = {
  EXPECTED_IS_NOT_A_JSON: 'integrityFailedExpectedIsNotAJSON',
  FILES_MISSING: 'integrityFailedFilesMissing',
  LOCKFILE_DONT_MATCH: 'integrityLockfilesDontMatch',
  FLAGS_DONT_MATCH: 'integrityFlagsDontMatch',
  LINKED_MODULES_DONT_MATCH: 'integrityCheckLinkedModulesDontMatch',
};

type IntegrityError = $Keys<typeof integrityErrors>;

export type IntegrityCheckResult = {
  integrityFileMissing: boolean,
  integrityMatches?: boolean,
  integrityError?: IntegrityError,
  missingPatterns: Array<string>,
};

type IntegrityHashLocation = {
  locationFolder: string,
  locationPath: string,
  exists: boolean,
};

type IntegrityFile = {
  flags: Array<string>,
  linkedModules: Array<string>,
  topLevelPatters: Array<string>,
  lockfileEntries: {
    [key: string]: string,
  },
  files: Array<string>,
  artifacts: ?InstallArtifacts,
};

type IntegrityFlags = {
  flat: boolean,
  checkFiles: boolean,
};

/**
 *
 */
export default class InstallationIntegrityChecker {
  constructor(config: Config) {
    this.config = config;
  }

  config: Config;

  async _getModuleLocation(usedRegistries?: Set<RegistryNames>): Promise<string> {
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

    return loc || possibleFolders[0];
  }

  /**
   * Get the location of an existing integrity hash. If none exists then return the location where we should
   * write a new one.
   */

  async _getIntegrityHashLocation(usedRegistries?: Set<RegistryNames>): Promise<IntegrityHashLocation> {
    let locationFolder;

    if (this.config.enableMetaFolder) {
      locationFolder = path.join(this.config.lockfileFolder, constants.META_FOLDER);
    } else {
      locationFolder = await this._getModuleLocation(usedRegistries);
    }

    const locationPath = path.join(locationFolder, constants.INTEGRITY_FILENAME);
    const exists = await fs.exists(locationPath);

    return {
      locationFolder,
      locationPath,
      exists,
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

    Object.keys(lockfile).forEach(key => {
      result.lockfileEntries[key] = lockfile[key].resolved;
    });

    if (flags.checkFiles) {
      result.files = await this._getFilesDeep(modulesFolder);
    }

    return result;
  }

  async _getIntegrityFile(locationPath: string): Promise<?IntegrityFile> {
    const expectedRaw = await fs.readFile(locationPath);
    try {
      return JSON.parse(expectedRaw);
    } catch (e) {
      // ignore JSON parsing for legacy text integrity files compatibility
    }
    return null;
  }

  async _compareIntegrityFiles(
    actual: IntegrityFile,
    expected: ?IntegrityFile,
    checkFiles: boolean,
    locationFolder: string,
  ): Promise<'OK' | IntegrityError> {
    if (!expected) {
      return 'EXPECTED_IS_NOT_A_JSON';
    }
    if (!compareSortedArrays(actual.linkedModules, expected.linkedModules)) {
      return 'LINKED_MODULES_DONT_MATCH';
    }
    if (!compareSortedArrays(actual.flags, expected.flags)) {
      return 'FLAGS_DONT_MATCH';
    }
    for (const key of Object.keys(actual.lockfileEntries)) {
      if (actual.lockfileEntries[key] !== expected.lockfileEntries[key]) {
        return 'LOCKFILE_DONT_MATCH';
      }
    }
    for (const key of Object.keys(expected.lockfileEntries)) {
      if (actual.lockfileEntries[key] !== expected.lockfileEntries[key]) {
        return 'LOCKFILE_DONT_MATCH';
      }
    }
    if (checkFiles) {
      if (expected.files.length === 0) {
        // edge case handling - --check-fies is passed but .yarn-integrity does not contain any files
        // check and fail if there are file in node_modules after all.
        const actualFiles = await this._getFilesDeep(locationFolder);
        if (actualFiles.length > 0) {
          return 'FILES_MISSING';
        }
      } else {
        // TODO we may want to optimise this check by checking only for package.json files on very large trees
        for (const file of expected.files) {
          if (!await fs.exists(path.join(locationFolder, file))) {
            return 'FILES_MISSING';
          }
        }
      }
    }
    return 'OK';
  }

  async check(
    patterns: Array<string>,
    lockfile: {[key: string]: LockManifest},
    flags: IntegrityFlags,
    workspaceLayout: ?WorkspaceLayout,
  ): Promise<IntegrityCheckResult> {
    // check if patterns exist in lockfile
    const missingPatterns = patterns.filter(
      p => !lockfile[p] && (!workspaceLayout || !workspaceLayout.getManifestByPattern(p)),
    );

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
      Object.assign({}, flags, {checkFiles: false}), // don't generate files when checking, we check the files below
      await this._getModuleLocation(),
    );
    const expected = await this._getIntegrityFile(loc.locationPath);
    const integrityMatches = await this._compareIntegrityFiles(actual, expected, flags.checkFiles, loc.locationFolder);

    return {
      integrityFileMissing: false,
      integrityMatches: integrityMatches === 'OK',
      integrityError: integrityMatches === 'OK' ? undefined : integrityMatches,
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
    artifacts: InstallArtifacts,
  ): Promise<void> {
    const moduleFolder = await this._getModuleLocation(usedRegistries);
    const integrityFile = await this._generateIntegrityFile(lockfile, patterns, flags, moduleFolder, artifacts);

    const loc = await this._getIntegrityHashLocation(usedRegistries);
    invariant(loc.locationPath, 'expected integrity hash location');

    await fs.mkdirp(path.dirname(loc.locationPath));
    await fs.writeFile(loc.locationPath, JSON.stringify(integrityFile, null, 2));
  }

  async removeIntegrityFile(): Promise<void> {
    const loc = await this._getIntegrityHashLocation();
    if (loc.exists) {
      await fs.unlink(loc.locationPath);
    }
  }
}
