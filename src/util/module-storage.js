/* @flow */

import type Config from '../config.js';
import type Reporter from '../reporters/base-reporter.js';
import type BaseRegistry from '../registries/base-registry.js';
import type {RegistryNames} from '../registries/index.js';
import {registryNames} from '../registries/index.js';
import * as fs from './fs.js';
import * as promise from './promise.js';

const glob = promise.promisify(require('glob'));
const invariant = require('invariant');
const path = require('path');
const uuid = require('uuid/v1');

function getOriginalFolderName(overriddenFolder: string): string {
  // "/home/foo/bar/node_modules.aaaa-bbbb-cccc-dddd" -> "node_modules"
  return path.basename(overriddenFolder, path.extname(overriddenFolder));
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await fs.stat(path)).isDirectory();
  } catch (e) {
    if (e.code == 'ENOENT') {
      return false;
    }
    throw e;
  }
}

/**
 * Represents an override of a module folder used by a package registry.
 */
class Override {
  constructor() {
    this.isActive = false;
    this.newFolder = '';
  }

  isActive: boolean;
  newFolder: string;

  get originalFolder(): string {
    return getOriginalFolderName(this.newFolder);
  }

  async activate(registry: BaseRegistry): Promise<void> {
    const origFolder = registry.folder;
    const randomUuid = uuid();
    const tempFolder = `${registry.folder}.${randomUuid}`;

    try {
      await fs.rename(path.join(registry.cwd, origFolder), path.join(registry.cwd, tempFolder));
    } catch (e) {
      if (e.code == 'ENOENT') {
        throw new Error(
          `cannot activate module storage override for ${registry.name}: original ${origFolder} does not exist`,
        );
      }
      throw e;
    }

    this.newFolder = tempFolder;
    this.isActive = true;
  }

  async deactivate(registry: BaseRegistry): Promise<void> {
    invariant(
      registry.folder == this.newFolder,
      `actual folder ${registry.folder} is different than the remembered override ${this.newFolder}`,
    );

    const origPath = path.join(registry.cwd, this.originalFolder);
    const tempPath = path.join(registry.cwd, this.newFolder);
    try {
      await fs.rename(tempPath, origPath);
    } catch (e) {
      if (e.code == 'EEXIST') {
        throw new Error(`cannot remove override on ${registry.name}: original ${this.originalFolder} already exists`);
      }
      throw e;
    }

    this.isActive = false;
  }
}

/**
 * Manages the storage of modules for different package registries.
 */
export default class ModuleStorage {
  constructor(config: Config, reporter: Reporter) {
    this.config = config;
    this.reporter = reporter;
    this._overrides = {};
    for (const name of registryNames) {
      this._overrides[name] = new Override();
    }
  }

  // TODO: don't hardcode this here, have each registry class define its
  // base module folder name instead
  static baseFolderNames = ['node_modules'];

  config: Config;
  reporter: Reporter;
  _overrides: {[_: RegistryNames]: Override};

  /**
   * Override the module folder for given registry.
   * Returns the new folder name (which will be a temporary folder).
   */
  async override(registry: BaseRegistry): Promise<string> {
    const registryName = registry.name;
    const override = this._overrides[registryName];
    invariant(!override.isActive, `module storage override already active for ${registryName}: ${override.newFolder}`);

    await override.activate(registry);
    this.reporter.verbose(
      `activated module folder override for registry ${registryName}: ` +
        `${override.originalFolder} -> ${override.newFolder}`,
    );

    registry._folder = override.newFolder;
    return override.newFolder;
  }

  /**
   * Remove override from module folder of given registry.
   * Returns the original folder.
   */
  async removeOverride(registry: BaseRegistry): Promise<string> {
    const registryName = registry.name;
    const override = this._overrides[registryName];
    invariant(override.isActive, `no module storage override active for ${registryName}`);

    await override.deactivate(registry);
    this.reporter.verbose(
      `removed module folder override for registry ${registryName}: ` +
        `${override.newFolder} -> ${override.originalFolder}`,
    );

    registry._folder = override.originalFolder;
    return override.originalFolder;
  }

  /**
   * Check if a module folder override is active for given registry.
   */
  isOverrideActive(registry: BaseRegistry): boolean {
    return this._overrides[registry.name].isActive;
  }

  /**
   * Purge all module storage folders (stale or otherwise).
   */
  async purge(): Promise<void> {
    const moduleFolders = await this._getAllModuleFolders();
    for (const folder of moduleFolders) {
      await fs.unlink(folder);
    }
  }

  async _getAllModuleFolders(): Promise<Array<string>> {
    const result = await this._getStaleTempFolders();

    // Include the regular module storage folders.
    for (const folder of ModuleStorage.baseFolderNames) {
      const folderPath = path.join(this.config.cwd, folder);
      if (await isDirectory(folderPath)) {
        result.push(folderPath);
      }
    }
    return result;
  }

  /**
   * Make sure the module storage is in a consistent state,
   * repairing any possible damage.
   * Returns whether the consistency is guaranteed.
   */
  async ensureConsistency(): Promise<boolean> {
    const staleFolders = await this._getStaleTempFolders();
    return !staleFolders.length || this._repair(staleFolders);
  }

  /**
   * Get any stale, unexpected temporary module folders.
   */
  async _getStaleTempFolders(): Promise<Array<string>> {
    let globPattern;
    if (ModuleStorage.baseFolderNames.length > 1) {
      globPattern = '{' + ModuleStorage.baseFolderNames.join(',') + '}.*';
    } else {
      globPattern = ModuleStorage.baseFolderNames[0] + '.*';
    }

    const fsEntries = await glob(path.join(this.config.cwd, globPattern));
    const directories = fsEntries.filter(isDirectory);
    if (fsEntries.length > directories.length) {
      const spuriousCount = fsEntries.length - directories.length;
      this.reporter.warn(`Found ${spuriousCount} files matching module directory names`);
    }

    return directories;
  }

  /**
   * Repair corrupted module storage state.
   * Return whether it was possible
   * (otherwise all module storage folders must be nuked & recreated).
   */
  async _repair(temporaryFolders: Array<string>): Promise<boolean> {
    // Group the temporary folders by their basename, i.e. registry they belong to.
    const groupedFolders: {[_: string]: Array<string>} = {};
    for (const folder of temporaryFolders) {
      const original = path.join(this.config.cwd, getOriginalFolderName(folder));
      const folders = groupedFolders[original] || [];
      folders.push(folder);
      groupedFolders[original] = folders;
    }

    // Restore them to a presentable state.
    // Don't fail imemdiately if something goes wrong for one registry,
    // as we may be able to restore the folders for some other registries.
    let success = true;
    for (const original of Object.keys(groupedFolders)) {
      const temps = groupedFolders[original];
      if (temps.length == 0) {
        continue; // This registry is consistent, nothing to do.
      }

      // If the original folder still exists, simply remove all the stale oens.
      if (await isDirectory(original)) {
        this.reporter.verbose(`Repairing module storage folder ${original} by removing ${temps.length} stale folders`);
        for (const temp of temps) {
          await fs.unlink(temp);
        }
        continue;
      }

      // Otherwise, promote the only stale folder into a new original.
      if (temps.length == 1) {
        this.reporter.verbose(`Repairing module storage folder: ${temps[0]} -> ${original}`);
        await fs.rename(temps[0], original);
        continue;
      }

      // If there is more than one stale folder, we cannot decide which one
      // is correct, so declare failure.
      success = false;
    }

    return success;
  }
}
