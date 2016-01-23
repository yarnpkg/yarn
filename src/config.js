/* @flow */

import type { PackageRegistry } from "./resolvers";
import { MessageError } from "./errors";
import { getRegistryResolver } from "./resolvers";
import * as constants from "./constants";
import * as promise from "./util/promise";
import * as fs from "./util/fs";

let invariant = require("invariant");
let lockfile  = promise.promisifyObject(require("lockfile"));
let path      = require("path");
let os        = require("os");

type ConfigOptions = {
  cwd?: string;
  packageRoot?: string;
};

export default class Config {
  modulesFolder: string;
  lockLocation: string;
  packagesRoot: string;
  tempFolder: string;
  cwd: string;

  moduleFolders: {
    [registryName: PackageRegistry]: string
  };

  registryConfig: {
    [registryName: PackageRegistry]: Promise<Object>
  };

  async initialise(opts: ConfigOptions = {}): Promise<void> {
    this.cwd = opts.cwd || process.cwd();

    this.registryConfig = Object.create(null);
    this.moduleFolders  = Object.create(null);

    this.packagesRoot  = await this.getPackageRoot(opts);
    this.tempFolder    = await this.getTempFolder();
    this.lockLocation  = this.getTemp(constants.LOCKFILE_FILENAME);

    await this.lock();
  }

  async getRegistryConfig(registry: PackageRegistry): Promise<Object> {
    let cached = this.registryConfig[registry];
    if (cached) {
      return cached;
    } else {
      return this.registryConfig[registry] = getRegistryResolver(registry).getConfig(this.cwd);
    }
  }

  generateHardModulePath(pkg: ?{
    name: string,
    uid: string,
    version: string,
    registry: PackageRegistry
  }): string {
    invariant(pkg, "Undefined package");
    invariant(pkg.name, "No name field in package");
    invariant(pkg.uid, "No uid field in package");

    let name = pkg.name;
    let uid = pkg.uid;
    if (pkg.registry) {
      name = `${pkg.registry}-${name}`;
      uid = pkg.version || uid;
    }

    return path.join(this.packagesRoot, `${name}-${uid}`);
  }

  getTemp(filename: string): string {
    return path.join(this.tempFolder, filename);
  }

  async lock(): Promise<void> {
    if (await lockfile.check(this.lockLocation)) {
      throw new MessageError("There appears to already be a kpm process running. Please wait for it to finish before spawning another.");
    } else {
      await lockfile.lock(this.lockLocation);
    }
  }

  async unlock(): Promise<void> {
    await lockfile.unlock(this.lockLocation);
  }

  async getModulesFolder(registry: PackageRegistry): Promise<string> {
    let cached = this.moduleFolders[registry];
    if (cached) return cached;

    let folderName = getRegistryResolver(registry).directory;
    let parts = this.cwd.split(path.sep);

    let found = path.join(this.cwd, folderName);

    while (parts.length) {
      let loc = parts.concat(folderName).join(path.sep);

      if (await fs.exists(loc)) {
        found = loc;
        break;
      } else {
        parts.pop();
      }
    }

    await fs.mkdirp(found);

    return this.moduleFolders[registry] = found;
  }

  async getTempFolder(): Promise<string> {
    let folder = path.join(this.packagesRoot, ".tmp");
    await fs.mkdirp(folder);
    return folder;
  }

  async getPackageRoot(opts: ConfigOptions): Promise<string> {
    if (opts.packagesRoot) {
      return opts.packagesRoot;
    }

    // walk up from current directory looking for kpm_modules folders
    let parts = this.cwd.split(path.sep);
    for (let i = parts.length; i > 0; i--) {
      let loc = parts.slice(0, i).concat("kpm_modules").join(path.sep);
      if (await fs.exists(loc)) return loc;
    }

    // try and create ~/.kpm
    // $FlowFixMe: wait until next version of flow to have this definition
    let loc = path.join(os.homedir(), ".kpm");
    await fs.mkdirp(loc);
    return loc;
  }
}
