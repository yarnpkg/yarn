/* @flow */

import type Config from './config.js';
import type {LockManifest} from './lockfile/wrapper.js';
import * as constants from './constants.js';
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
  PATTERNS_DONT_MATCH: 'integrityPatternsDontMatch',
  MODULES_FOLDERS_MISSING: 'integrityModulesFoldersMissing',
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
  modulesFolders: Array<string>,
  linkedModules: Array<string>,
  topLevelPatterns: Array<string>,
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

  /**
   * Get the common ancestor of every node_modules - it might be a node_modules directory itself, but isn't required to.
   */

  _getModulesRootFolder(): string {
    if (this.config.modulesFolder) {
      return this.config.modulesFolder;
    } else if (this.config.workspaceRootFolder) {
      return this.config.workspaceRootFolder;
    } else {
      return path.join(this.config.lockfileFolder, 'node_modules');
    }
  }

  /**
   * Get the directory in which the yarn-integrity file should be written.
   */

  _getIntegrityFileFolder(): string {
    if (this.config.modulesFolder) {
      return this.config.modulesFolder;
    } else if (this.config.enableMetaFolder) {
      return path.join(this.config.lockfileFolder, constants.META_FOLDER);
    } else {
      return path.join(this.config.lockfileFolder, 'node_modules');
    }
  }

  /**
   * Get the full path of the yarn-integrity file.
   */

  async _getIntegrityFileLocation(): Promise<IntegrityHashLocation> {
    const locationFolder = this._getIntegrityFileFolder();
    const locationPath = path.join(locationFolder, constants.INTEGRITY_FILENAME);

    const exists = await fs.exists(locationPath);

    return {
      locationFolder,
      locationPath,
      exists,
    };
  }

  /**
   * Get the list of the directories that contain our modules (there might be multiple such folders b/c of workspaces).
   */

  _getModulesFolders({workspaceLayout}: {workspaceLayout: ?WorkspaceLayout} = {}): Array<string> {
    const locations = [];

    if (this.config.modulesFolder) {
      locations.push(this.config.modulesFolder);
    } else {
      locations.push(path.join(this.config.lockfileFolder, 'node_modules'));
    }

    if (workspaceLayout) {
      for (const workspaceName of Object.keys(workspaceLayout.workspaces)) {
        const loc = workspaceLayout.workspaces[workspaceName].loc;

        if (loc) {
          locations.push(path.join(loc, 'node_modules'));
        }
      }
    }

    return locations;
  }

  /**
   * Get a list of the files that are located inside our module folders.
   */
  async _getIntegrityListing({workspaceLayout}: {workspaceLayout: ?WorkspaceLayout} = {}): Promise<Array<string>> {
    const files = [];

    const recurse = async dir => {
      if (!await fs.exists(dir)) {
        return;
      }

      for (const file of await fs.readdir(dir)) {
        const entry = path.join(dir, file);
        const stat = await fs.lstat(entry);

        if (stat.isDirectory()) {
          await recurse(entry);
        } else {
          files.push(entry);
        }
      }
    };

    for (const modulesFolder of this._getModulesFolders({workspaceLayout})) {
      await recurse(modulesFolder);
    }

    return files;
  }

  /**
   * Generate integrity hash of input lockfile.
   */

  async _generateIntegrityFile(
    lockfile: {[key: string]: LockManifest},
    patterns: Array<string>,
    flags: IntegrityFlags,
    workspaceLayout: ?WorkspaceLayout,
    artifacts?: InstallArtifacts,
  ): Promise<IntegrityFile> {
    const result: IntegrityFile = {
      modulesFolders: [],
      flags: [],
      linkedModules: [],
      topLevelPatterns: [],
      lockfileEntries: {},
      files: [],
      artifacts,
    };

    result.topLevelPatterns = patterns.sort(sortAlpha).filter(p => {
      return !workspaceLayout || !workspaceLayout.getManifestByPattern(p);
    });

    // If using workspaces, we also need to add the workspaces patterns to the top-level, so that we'll know if a
    // dependency is added or removed into one of them. We must take care not to read the aggregator.
    if (workspaceLayout) {
      for (const name of Object.keys(workspaceLayout.workspaces)) {
        if (workspaceLayout.workspaces[name].loc) {
          result.topLevelPatterns = result.topLevelPatterns.concat(
            workspaceLayout.workspaces[name].manifest._reference.patterns,
          );
        }
      }
    }

    if (flags.checkFiles) {
      result.flags.push('checkFiles');
    }

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

    for (const key of Object.keys(lockfile)) {
      result.lockfileEntries[key] = lockfile[key].resolved || '';
    }

    for (const modulesFolder of this._getModulesFolders({workspaceLayout})) {
      if (await fs.exists(modulesFolder)) {
        result.modulesFolders.push(path.relative(this.config.lockfileFolder, modulesFolder));
      }
    }

    if (flags.checkFiles) {
      const modulesRoot = this._getModulesRootFolder();

      result.files = (await this._getIntegrityListing({workspaceLayout}))
        .map(entry => path.relative(modulesRoot, entry))
        .sort(sortAlpha);
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

  _compareIntegrityFiles(
    actual: IntegrityFile,
    expected: ?IntegrityFile,
    checkFiles: boolean,
    workspaceLayout: ?WorkspaceLayout,
  ): 'OK' | IntegrityError {
    if (!expected) {
      return 'EXPECTED_IS_NOT_A_JSON';
    }

    if (!compareSortedArrays(actual.linkedModules, expected.linkedModules)) {
      return 'LINKED_MODULES_DONT_MATCH';
    }

    let relevantExpectedFlags = expected.flags.slice();

    // If we run "yarn" after "yarn --check-files", we shouldn't fail the less strict validation
    if (actual.flags.indexOf('checkFiles') === -1) {
      relevantExpectedFlags = relevantExpectedFlags.filter(flag => flag !== 'checkFiles');
    }

    if (!compareSortedArrays(actual.flags, relevantExpectedFlags)) {
      return 'FLAGS_DONT_MATCH';
    }

    if (!compareSortedArrays(actual.topLevelPatterns, expected.topLevelPatterns || [])) {
      return 'PATTERNS_DONT_MATCH';
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
      // Early bailout if we expect more files than what we have
      if (expected.files.length > actual.files.length) {
        return 'FILES_MISSING';
      }

      // Since we know the "files" entry is sorted (alphabetically), we can optimize the thing
      // Instead of storing the files in a Set, we can just iterate both arrays at once. O(n)!
      for (let u = 0, v = 0; u < expected.files.length; ++u) {
        // Number of iterations after which there won't be enough entries remaining for the arrays to match
        const max = actual.files.length - expected.files.length;

        // Skip over files that have been added (not present in 'expected')
        while (v < max && actual.files[v] !== expected.files[u]) {
          v += 1;
        }

        // If we've reached the end of the actual array, the file is missing
        if (v === max) {
          return 'FILES_MISSING';
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

    const loc = await this._getIntegrityFileLocation();
    if (missingPatterns.length || !loc.exists) {
      return {
        integrityFileMissing: !loc.exists,
        missingPatterns,
      };
    }

    const actual = await this._generateIntegrityFile(lockfile, patterns, flags, workspaceLayout);

    const expected = await this._getIntegrityFile(loc.locationPath);
    let integrityMatches = this._compareIntegrityFiles(actual, expected, flags.checkFiles, workspaceLayout);

    if (integrityMatches === 'OK') {
      invariant(expected, "The integrity shouldn't pass without integrity file");
      for (const modulesFolder of expected.modulesFolders) {
        if (!await fs.exists(path.join(this.config.lockfileFolder, modulesFolder))) {
          integrityMatches = 'MODULES_FOLDERS_MISSING';
        }
      }
    }

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
    const loc = await this._getIntegrityFileLocation();
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
    workspaceLayout: ?WorkspaceLayout,
    artifacts: InstallArtifacts,
  ): Promise<void> {
    const integrityFile = await this._generateIntegrityFile(lockfile, patterns, flags, workspaceLayout, artifacts);

    const loc = await this._getIntegrityFileLocation();
    invariant(loc.locationPath, 'expected integrity hash location');

    await fs.mkdirp(path.dirname(loc.locationPath));
    await fs.writeFile(loc.locationPath, JSON.stringify(integrityFile, null, 2));
  }

  async removeIntegrityFile(): Promise<void> {
    const loc = await this._getIntegrityFileLocation();
    if (loc.exists) {
      await fs.unlink(loc.locationPath);
    }
  }
}
