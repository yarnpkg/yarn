/* @flow */

import type { PackageRegistry } from "./resolvers";
import type Reporter from "./reporters/_base";
import ConstraintResolver from "./package-constraint-resolver";
import RequestManager from "./util/request-manager";
import { getRegistryResolver } from "./resolvers";
import * as fs from "./util/fs";
import map from "./util/map";

let invariant = require("invariant");
let path      = require("path");
let os        = require("os");

type ConfigOptions = {
  cwd?: string,
  packagesRoot?: string,
  tempFolder?: string
};

export default class Config {
  constructor(reporter: Reporter, opts?: ConfigOptions = {}) {
    this.constraintResolver = new ConstraintResolver(this, reporter);
    this.requestManager     = new RequestManager(reporter);
    this.reporter           = reporter;

    this.registryConfig = map();
    this.moduleFolders  = map();
    this.cwd            = process.cwd();

    this.packagesRoot = opts.packagesRoot;
    this.tempFolder   = opts.tempFolder;
  }

  constraintResolver: ConstraintResolver;
  requestManager: RequestManager;
  modulesFolder: string;
  packagesRoot: ?string;
  tempFolder: ?string;
  reporter: Reporter;
  cwd: string;

  moduleFolders: {
    [registryName: PackageRegistry]: string
  };

  registryConfig: {
    [registryName: PackageRegistry]: Promise<Object>
  };

  resolveConstraints(versions: Array<string>, range: string): Promise<string> {
    return this.constraintResolver.reduce(versions, range);
  }

  async init(opts: ConfigOptions = {}): Promise<void> {
    if (opts.cwd) {
      this.cwd = opts.cwd;
    }

    if (!this.tempFolder) {
      this.tempFolder = await this.getTempFolder();
    }

    this.packagesRoot = await this.getPackageRoot(opts);
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
    invariant(this.packagesRoot, "No package root");

    let name = pkg.name;
    let uid = pkg.uid;
    if (pkg.registry) {
      name = `${pkg.registry}-${name}`;
      uid = pkg.version || uid;
    }

    return path.join(this.packagesRoot, `${name}-${uid}`);
  }

  getTemp(filename: string): string {
    invariant(this.tempFolder, "No temp folder");
    return path.join(this.tempFolder, filename);
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
    invariant(this.packagesRoot, "No package root");
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
    let loc = path.join(os.homedir(), ".kpm");
    await fs.mkdirp(loc);
    return loc;
  }
}
