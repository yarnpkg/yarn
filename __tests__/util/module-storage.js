/* @flow */

import Config from '../../src/config.js';
import type BaseRegistry from '../../src/registries/base-registry.js';
import {registryNames} from '../../src/registries/index.js';
import ModuleStorage from '../../src/util/module-storage.js';
import {Reporter, NoopReporter} from '../../src/reporters/index.js';
import makeTemp from '../_temp.js';
import * as fs from '../../src/util/fs.js';

describe('ModuleStorage', () => {
  let config: Config;
  let reporter: Reporter;
  let moduleStorage: ModuleStorage;

  beforeEach(async () => {
    reporter = new NoopReporter();

    config = await Config.create(
      {
        cwd: await makeTemp(),
      },
      reporter,
    );
    moduleStorage = new ModuleStorage(config, reporter);

    // Create the module storage folders for all registries.
    for (const registry of getRegistries(config)) {
      await fs.mkdirp(registry.loc);
    }
  });

  it('has no overrides active by default', () => {
    for (const registry of getRegistries(config)) {
      expect(moduleStorage.isOverrideActive(registry)).toBe(false);
    }
  });

  it('can override the module folder for a registry', async () => {
    const registry = config.registries.npm;
    const originalFolder = registry.folder;
    const originalLoc = registry.loc;

    const newFolder = await moduleStorage.override(registry);
    const newLoc = registry.loc;

    expect(newFolder).toEqual(registry.folder);
    expect(newFolder).not.toEqual(originalFolder);
    expect(await isDirectory(newLoc)).toBe(true);
    expect(await fs.exists(originalLoc)).toBe(false);
    expect(moduleStorage.isOverrideActive(registry)).toBe(true);
  });

  it('cannot remove an override that isnt active', async () => {
    const registry = config.registries.npm;
    expect(moduleStorage.isOverrideActive(registry)).toBe(false);

    try {
      await moduleStorage.removeOverride(registry);
      fail();
    } catch (e) {
      expect(e.toString()).toContain('no module storage override active');
    }
    expect(moduleStorage.isOverrideActive(registry)).toBe(false);
  });

  it('can remove an active module storage override', async () => {
    const registry = config.registries.npm;
    const originalFolder = registry.folder;
    const originalLoc = registry.loc;

    // Set up an override.
    const newFolder = await moduleStorage.override(registry);
    const newLoc = registry.loc;
    expect(moduleStorage.isOverrideActive(registry)).toBe(true);
    expect(await fs.exists(originalLoc)).toBe(false);

    // Now remove it, and check if the module folder is properly restored.
    const restoredFolder = await moduleStorage.removeOverride(registry);
    const restoredLoc = registry.loc;
    expect(moduleStorage.isOverrideActive(registry)).toBe(false);

    expect(restoredFolder).toEqual(registry.folder);
    expect(restoredFolder).toEqual(originalFolder);
    expect(restoredFolder).not.toEqual(newFolder);
    expect(restoredLoc).toEqual(originalLoc);
    expect(restoredLoc).not.toEqual(newLoc);
    expect(await isDirectory(restoredLoc)).toBe(true);
    expect(await fs.exists(newLoc)).toBe(false);
  });

  it('cannot override the module folder if it is missing', async () => {
    const registry = config.registries.npm;
    await fs.unlink(registry.loc);

    try {
      await moduleStorage.override(registry);
      fail();
    } catch (e) {
      expect(e.toString()).toContain(`${registry.folder} does not exist`);
    }
    expect(moduleStorage.isOverrideActive(registry)).toBe(false);
  });

  it('can purge all the module folders when needed', async () => {
    await moduleStorage.purge();
    for (const registry of getRegistries(config)) {
      expect(await fs.exists(registry.loc)).toBe(false);
    }
  });

  it('does not repair a consistent state of module storage', async () => {
    const originalState = await fs.readdir(config.cwd);
    await moduleStorage.ensureConsistency();
    const newState = await fs.readdir(config.cwd);
    expect(newState).toEqual(originalState);
  });

  it('can restore one stale folder of a registry', async () => {
    const registry = config.registries.npm;
    const defaultLoc = registry.loc;

    // Pretend we've lost a module folder override.
    await new ModuleStorage(config, reporter).override(registry);
    const staleLoc = registry.loc;

    // This should be easily restorable.
    const success = await moduleStorage.ensureConsistency();
    expect(success).toBe(true);
    expect(await isDirectory(defaultLoc)).toBe(true);
    expect(await fs.exists(staleLoc)).toBe(false);
  });

  it('can remove all stale folders if the origignal is present', async () => {
    const registry = config.registries.npm;
    const defaultFolder = registry.folder;
    const defaultLoc = registry.loc;

    // Produce a few stale folders.
    const staleLocs = [];
    await fs.unlink(defaultLoc);
    for (let i = 0; i < 3; i++) {
      await fs.mkdirp(defaultLoc);
      await new ModuleStorage(config, reporter).override(registry);
      staleLocs.push(registry.loc);
      registry._folder = defaultFolder;
    }
    await fs.mkdirp(defaultLoc); // But ensure the original folder exists.

    // This should be restorable.
    const success = await moduleStorage.ensureConsistency();
    expect(success).toBe(true);
    expect(await isDirectory(defaultLoc)).toBe(true);
    for (const staleLoc of staleLocs) {
      expect(await isDirectory(staleLoc)).toBe(false);
    }
  });

  it('gives up if there are >1 stale folders w/o original', async () => {
    const registry = config.registries.npm;
    const defaultFolder = registry.folder;
    const defaultLoc = registry.loc;

    // Produce some serious inconsistency.
    const staleLocs = [];
    await fs.unlink(defaultLoc);
    for (let i = 0; i < 3; i++) {
      await fs.mkdirp(defaultLoc);
      await new ModuleStorage(config, reporter).override(registry);
      staleLocs.push(registry.loc);
      registry._folder = defaultFolder;
    }

    // This shouldn't be fixable.
    const success = await moduleStorage.ensureConsistency();
    expect(success).toBe(false);
    expect(await fs.exists(defaultLoc)).toBe(false);
    for (const staleLoc of staleLocs) {
      expect(await isDirectory(staleLoc)).toBe(true);
    }
  });
});

function getRegistries(config: Config): Array<BaseRegistry> {
  const registries = [];
  for (const name of registryNames) {
    const registry = ((config.registries[name]: any): BaseRegistry);
    registries.push(registry);
  }
  return registries;
}

async function isDirectory(path: string): Promise<boolean> {
  return (await fs.exists(path)) && (await fs.stat(path)).isDirectory();
}

function fail() {
  expect(true).toBe(false);
}
