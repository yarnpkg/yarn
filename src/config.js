/* @flow */

import type { RegistryNames } from "./registries";
import type Reporter from "./reporters/_base";
import type Registry from "./registries/_base";
import ConstraintResolver from "./package-constraint-resolver";
import RequestManager from "./util/request-manager";
import { registries } from "./registries";
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

    this.registries = map();
    this.cwd        = process.cwd();

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

  registries: {
    [name: RegistryNames]: Registry
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

    for (let key of Object.keys(registries)) {
      let Registry = registries[key];

      // instantiate registry
      let registry = new Registry(this.cwd);
      await registry.init();

      this.registries[key] = registry;
    }
  }

  generateHardModulePath(pkg: ?{
    name: string,
    uid: string,
    version: string,
    registry: RegistryNames
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
