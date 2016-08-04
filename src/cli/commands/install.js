/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import type { Reporter } from "../../reporters/index.js";
import type { DependencyRequestPatterns } from "../../types.js";
import type Config from "../../config.js";
import Lockfile from "../../lockfile/index.js";
import lockStringify from "../../lockfile/stringify.js";
import PackageInstallScripts from "../../package-install-scripts.js";
import PackageCompatibility from "../../package-compatibility.js";
import PackageResolver from "../../package-resolver.js";
import PackageLinker from "../../package-linker.js";
import PackageRequest from "../../package-request.js";
import { buildTree } from "./ls.js";
import { registries } from "../../registries/index.js";
import * as constants from "../../constants.js";
import * as fs from "../../util/fs.js";
import * as util from "../../util/misc.js";
import { stringify } from "../../util/misc.js";
import map from "../../util/map.js";

let invariant = require("invariant");
let emoji     = require("node-emoji");
let path      = require("path");

type InstallActions = "install" | "update" | "uninstall" | "ls";

export class Install {
  constructor(
    action: InstallActions,
    flags: Object,
    args: Array<string>,
    config: Config,
    reporter: Reporter,
    lockfile: Lockfile,
  ) {
    this.rootPatternsToOrigin = map();
    this.resolutions          = map();
    this.registries           = [];
    this.lockfile             = lockfile;
    this.reporter             = reporter;
    this.config               = config;
    this.action               = action;
    this.flags                = flags;
    this.args                 = args;

    this.resolver      = new PackageResolver(config, lockfile);
    this.compatibility = new PackageCompatibility(config, this.resolver);
    this.linker        = new PackageLinker(config, this.resolver);
    this.scripts       = new PackageInstallScripts(config, this.resolver, flags.rebuild);
  }

  action: InstallActions;
  args: Array<string>;
  flags: Object;
  registries: Array<string>;
  lockfile: Lockfile;
  resolutions: { [packageName: string]: string };
  config: Config;
  reporter: Reporter;
  resolver: PackageResolver;
  scripts: PackageInstallScripts;
  linker: PackageLinker;
  compatibility: PackageCompatibility;
  rootPatternsToOrigin: { [pattern: string]: string };

  /**
   * TODO description
   */

  async fetchRequestFromCwd(excludePatterns?: Array<string> = []): Promise<[
    DependencyRequestPatterns,
    Array<string>,
    Object
  ]> {
    let patterns = [];
    let deps = [];
    let manifest = {};

    // exclude package names that are in install args
    let excludeNames = [];
    for (let pattern of excludePatterns) {
      // can't extract a package name from this
      if (PackageRequest.getExoticResolver(pattern)) continue;

      // extract the name
      let parts = PackageRequest.normalisePattern(pattern);
      excludeNames.push(parts.name);
    }

    for (let registry of Object.keys(registries)) {
      let filenames = registries[registry].filenames;

      for (let filename of filenames) {
        let loc = path.join(this.config.cwd, filename);
        if (!(await fs.exists(loc))) continue;

        this.registries.push(registry);

        let json = await fs.readJson(loc);
        Object.assign(this.resolutions, json.resolutions);
        Object.assign(manifest, json);

        let pushDeps = (depType, { hint, ignore, optional }) => {
          let depMap = json[depType];
          for (let name in depMap) {
            if (excludeNames.indexOf(name) >= 0) continue;

            let pattern = name;
            if (!this.lockfile.getLocked(pattern, true)) {
              // when we use --save we save the dependency to the lockfile with just the name rather than the
              // version combo
              pattern += "@" + depMap[name];
            }

            this.rootPatternsToOrigin[pattern] = depType;
            patterns.push(pattern);
            deps.push({ pattern, registry, ignore, hint, optional });
          }
        };

        pushDeps("dependencies", { hint: null, ignore: false, optional: false });
        pushDeps("devDependencies", { hint: "dev", ignore: !!this.flags.production, optional: false });
        pushDeps("optionalDependencies", { hint: "optional", ignore: false, optional: true });

        break;
      }
    }

    return [deps, patterns, manifest];
  }

  async init(): Promise<void> {
    let [depRequests, rawPatterns] = await this.fetchRequestFromCwd(this.args);

    // calculate deps we need to install
    if (this.args.length) {
      // just use the args passed in the cli
      rawPatterns = rawPatterns.concat(this.args);

      for (let pattern of rawPatterns) {
        // default the registry to npm, if the pattern contains an exotic registry
        // in the pattern then it'll be set to it
        depRequests.push({ pattern, registry: "npm" });
      }
    }

    //
    this.reporter.step(1, 3, "Resolving and fetching packages", emoji.get("truck"));
    await this.resolver.init(depRequests);
    let patterns = await this.flatten(rawPatterns);
    await this.compatibility.init();

    //
    this.reporter.step(2, 3, "Linking dependencies", emoji.get("link"));
    await this.linker.init(patterns);

    //
    this.reporter.step(
      3,
      3,
      this.flags.rebuild ? "Rebuilding all packages" : "Building fresh packages",
      emoji.get("page_with_curl")
    );
    await this.scripts.init();

    // fin!
    await this.maybeSaveTree(patterns);
    await this.savePackages();
    await this.saveLockfile();
  }

  /**
   * TODO
   */

  async maybeSaveTree(patterns: Array<string>) {
    if (!hasSaveFlags(this.flags)) return;

    let { trees, count } = await buildTree(this.resolver, this.linker, patterns, true);
    this.reporter.success(`Saved ${count} new ${count === 1 ? "dependency" : "dependencies"}`);
    this.reporter.tree("newDependencies", trees);
  }

  /**
   * Save added packages to `package.json` if any of the --save flags were used
   */

  async savePackages(): Promise<void> {
    if (!this.args.length) return;

    let { save, saveDev, saveExact, saveTilde, saveOptional, savePeer } = this.flags;
    if (!save && !saveDev && !saveOptional && !savePeer) return;

    let json = {};
    let jsonLoc = path.join(this.config.cwd, "package.json");
    if (await fs.exists(jsonLoc)) {
      json = await fs.readJson(jsonLoc);
    }

    for (let pattern of this.resolver.dedupePatterns(this.args)) {
      let pkg = this.resolver.getResolvedPattern(pattern);
      invariant(pkg, `missing package ${pattern}`);

      let parts = PackageRequest.normalisePattern(pattern);
      let version;
      if (parts.range) {
        // if the user specified a range then use it verbatim
        version = parts.range;
      } else if (PackageRequest.getExoticResolver(pattern)) {
        // wasn't a name/range tuple so this is just a raw exotic pattern
        version = pattern;
      } else if (saveTilde) { // --save-tilde
        version = `~${pkg.version}`;
      } else if (saveExact) { // --save-exact
        version = pkg.version;
      } else { // default to caret
        version = `^${pkg.version}`;
      }

      let targetKeys = [];
      if (save) targetKeys.push("dependencies");
      if (saveDev) targetKeys.push("devDependencies");
      if (savePeer) targetKeys.push("peerDependencies");
      if (saveOptional) targetKeys.push("optionalDependencies");
      if (!targetKeys.length) continue;

      // add it to package.json
      for (let key of targetKeys) {
        let target = json[key] = json[key] || {};
        target[pkg.name] = version;
      }

      // add pattern so it's aliased in the lockfile
      let newPattern = `${pkg.name}@${version}`;
      if (newPattern === pattern) continue;
      this.resolver.addPattern(newPattern, pkg);
      this.resolver.removePattern(pattern);
    }

    await fs.writeFile(jsonLoc, stringify(json) + "\n");
  }

  /**
   * TODO
   */

  async flatten(patterns: Array<string>): Promise<Array<string>> {
    if (!this.flags.flat) {
      return patterns;
    }

    for (let name of this.resolver.getAllDependencyNames()) {
      let infos = this.resolver.getAllInfoForPackageName(name);

      let firstRemote = infos[0] && infos[0].remote;
      invariant(firstRemote, "Missing first remote");

      if (infos.length === 1) {
        // single version of this package
        // take out a single pattern as multiple patterns may have resolved to this package
        patterns.push(this.resolver.patternsByPackage[name][0]);
        continue;
      }

      let versions = infos.map((info): string => info.version);
      let version: ?string;

      let resolutionVersion = this.resolutions[name];
      if (resolutionVersion && versions.indexOf(resolutionVersion) >= 0) {
        // use json `resolution` version
        version = resolutionVersion;
      } else {
        version = await this.reporter.select(
          `We found a version in package ${name} that we couldn't resolve`,
          "Please select a version you'd like to use",
          versions
        );
      }

      patterns.push(this.resolver.collapseAllVersionsOfPackage(name, version));
    }

    return patterns;
  }

  /**
   * TODO
   */

  async saveLockfile(): Promise<void> {
    // check if we should write a lockfile in the first place
    if (!shouldWriteLockfile(this.flags, this.args)) return;

    let loc = path.join(this.config.cwd, constants.LOCKFILE_FILENAME);

    // check if we should overwite a lockfile if it exists
    if (this.action === "install" && !shouldWriteLockfileIfExists(this.flags, this.args)) {
      if (await fs.exists(loc)) return;
    }

    let lockSource = lockStringify(this.lockfile.getLockfile(this.resolver.patterns)) + "\n";

    // write lockfile
    await fs.writeFile(loc, lockSource);

    // write integrity hash
    await fs.writeFile(
      path.join(this.config.cwd, "node_modules", constants.INTEGRITY_FILENAME),
      util.hash(lockSource)
    );

    this.reporter.success(`Saved lockfile to ${constants.LOCKFILE_FILENAME}`);
  }
}

/**
 * TODO
 */

function hasSaveFlags(flags: Object): boolean {
  return flags.save || flags.saveExact || flags.saveTilde ||
         flags.saveDev || flags.saveExact || flags.savePeer;
}

/**
 * TODO
 */

function isStrictLockfile(flags: Object, args: Array<string>): boolean {
  if (hasSaveFlags(flags)) {
    // we're introducing new dependencies so we can't be strict
    return false;
  }

  if (!args.length) {
    // we're running `kpm install` so should be strict on lockfile usage
    return true;
  }

  // we're installing individual modules
  return false;
}

/**
 * TODO
 */

function shouldWriteLockfileIfExists(flags: Object, args: Array<string>): boolean {
  if (args.length || flags.save) {
    return shouldWriteLockfile(flags, args);
  } else {
    return false;
  }
}

/**
 * TODO
 */

function shouldWriteLockfile(flags: Object, args: Array<string>): boolean {
  if (flags.lockfile === false) {
    return false;
  }

  if (hasSaveFlags(flags)) {
    // we should write a new lockfile as we're introducing new dependencies
    return true;
  }

  if (!args.length) {
    // we're running `kpm install` so should save a new lockfile
    return true;
  }

  return false;
}

export function setFlags(commander: Object) {
  commander.usage("install [packages ...] [flags]");
  commander.option("-f, --flat", "only allow one version of a package");
  commander.option("-S, --save", "save package to your `dependencies`");
  commander.option("-D, --save-dev", "save package to your `devDependencies`");
  commander.option("-P, --save-peer", "save package to your `peerDependencies`");
  commander.option("-O, --save-optional", "save package to your `optionalDependencies`");
  commander.option("-E, --save-exact", "");
  commander.option("-T, --save-tilde", "");
  commander.option("--rebuild", "rerun install scripts of modules already installed");
  commander.option("--production, --prod", "");
  commander.option("--no-lockfile");
  commander.option("--init-mirror", "initialise local package mirror and copy module tarballs");
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>
): Promise<void> {
  let lockfile;
  if (flags.lockfile !== false) {
    lockfile = await Lockfile.fromDirectory(config.cwd, reporter, {
      strictIfPresent: isStrictLockfile(flags, args),
      save: hasSaveFlags(flags) || flags.initMirror
    });
  } else {
    lockfile = new Lockfile;
  }

  let install = new Install("install", flags, args, config, reporter, lockfile);
  return install.init();
}
