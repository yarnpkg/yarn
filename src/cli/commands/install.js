/* @flow */

import type { RegistryNames } from "../../registries/index.js";
import type Reporter from "../../reporters/_base.js";
import type Config from "../../config.js";
import Lockfile from "../../lockfile/index.js";
import stringify from "../../lockfile/stringify.js";
import PackageInstallScripts from "../../package-install-scripts.js";
import PackageCompatibility from "../../package-compatibility.js";
import PackageResolver from "../../package-resolver.js";
import PackageLinker from "../../package-linker.js";
import { registries } from "../../registries/index.js";
import { MessageError, RelayError } from "../../errors.js";
import * as constants from "../../constants.js";
import * as promise from "../../util/promise.js";
import * as fs from "../../util/fs.js";
import map from "../../util/map.js";

let invariant = require("invariant");
let emoji     = require("node-emoji");
let path      = require("path");

export class Install {
  constructor(
    action: "install" | "update",
    flags: Object,
    args: Array<string>,
    config: Config,
    reporter: Reporter,
    lockfile: Lockfile
  ) {
    this.resolutions = map();
    this.registries  = [];
    this.lockfile    = lockfile;
    this.reporter    = reporter;
    this.config      = config;
    this.action      = action;
    this.flags       = flags;
    this.args        = args;

    this.resolver      = new PackageResolver(config, lockfile);
    this.compatibility = new PackageCompatibility(config, this.resolver);
    this.linker        = new PackageLinker(config, this.resolver);
    this.scripts       = new PackageInstallScripts(config, this.resolver);
  }

  action: "install" | "update";
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

  /**
   * TODO
   */

  async fetchRequestFromCwd(): Promise<[
    Array<{
      pattern: string,
      registry: RegistryNames,
      optional?: boolean
    }>,
    Array<string>
  ]> {
    let patterns = [];
    let deps = [];

    let foundConfig = false;

    for (let registry of Object.keys(registries)) {
      let filename = registries[registry].filename;
      let loc = path.join(this.config.cwd, filename);
      if (!(await fs.exists(loc))) continue;

      this.registries.push(registry);
      foundConfig = true;

      let json = await fs.readJson(loc);
      Object.assign(this.resolutions, json.resolutions);

      // plain deps
      let plainDepMap = Object.assign({}, json.dependencies, json.devDependencies);
      for (let name in plainDepMap) {
        let pattern = name + "@" + plainDepMap[name];
        patterns.push(pattern);
        deps.push({ pattern, registry });
      }

      // optional deps
      let optionalDeps = json.optionalDependencies;
      for (let name in optionalDeps) {
        let pattern = name + "@" + optionalDeps[name];
        patterns.push(pattern);
        deps.push({ pattern, registry, optional: true });
      }
    }

    if (foundConfig) {
      return [deps, patterns];
    } else {
      throw new Error(`No package metadata found in the current directory.`);
    }
  }

  async init(): Promise<void> {
    let patterns = [];
    let deps = [];

    // calculate deps we need to install
    if (this.args.length) {
      // just use the args passed in the cli
      patterns = this.args;
      for (let pattern of patterns) {
        deps.push({ pattern, registry: "npm" });
      }
    } else {
      [deps, patterns] = await this.fetchRequestFromCwd();
    }

    let total = 5;
    let i = 0;

    //
    let plainInstall = async function () {
      // reset
      total--;
      i = 0;

      //
      this.reporter.warn("Not using a relay server, this is going to be slower than usual");
      this.reporter.step(++i, total, "Resolving and fetching packages", emoji.get("turtle"));
      await this.resolver.init(deps);
      patterns = await this.flatten(patterns);
    };

    //
    if (this.lockfile.strict || this.config.relay) {
      try {
        this.reporter.step(++i, total, "Resolving dependencies", emoji.get("mag"));
        await this.resolver.init(deps);

        patterns = await this.flatten(patterns);

        this.reporter.step(++i, total, "Fetching packages", emoji.get("package"));
        await this.resolver.fetcher.init();
      } catch (err) {
        if (err instanceof RelayError) {
          this.reporter.error("Relay server errored. Falling back...");
          await plainInstall.call(this);
        } else {
          throw err;
        }
      }
    } else {
      await plainInstall.call(this);
    }

    //
    this.reporter.step(++i, total, "Checking package compatibility", emoji.get("white_check_mark"));
    await this.compatibility.init();

    //
    this.reporter.step(++i, total, "Linking dependencies", emoji.get("link"));
    await this.linker.init(this.flags.binLinks);

    //
    this.reporter.step(++i, total, "Running install scripts", emoji.get("page_with_curl"));
    await this.scripts.init();

    // fin!
    await this.saveLockfile();
    await this.saveAll(patterns);
  }

  /**
   * TODO
   */

  async flatten(patterns: Array<string>): Promise<Array<string>> {
    for (let name of this.resolver.getAllDependencyNames()) {
      let infos = this.resolver.getAllInfoForPackageName(name);

      let firstRemote = infos[0] && infos[0].remote;
      invariant(firstRemote, "Missing first remote");

      if (!this.flags.flat && !registries[firstRemote.registry].alwaysFlatten) {
        // if we haven't been given an explicit flat flag and this package doesn't belong
        // to a registry that always requires flattening then continue on our way
        // TODO: this doesn't take into account colliding packages on two registries #65
        continue;
      }

      if (infos.length === 1) {
        // single version of this package
        // take out a single pattern as multiple patterns may have resolved to this package
        patterns.push(this.resolver.patternsByPackage[name][0]);
        continue;
      }

      let versions = infos.map((info) => info.version);
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

    await fs.writeFile(
      loc,
      stringify(this.lockfile.getLockfile(this.resolver)) + "\n"
    );

    this.reporter.success(`Saved kpm lockfile to ${constants.LOCKFILE_FILENAME}`);
  }

  /**
   * TODO description
   */

  async save(pattern: string): Promise<void> {
    let resolved = this.resolver.getResolvedPattern(pattern);
    if (!resolved) throw new Error("Couldn't find resolved name/version for " + pattern);

    let src = this.config.generateHardModulePath(resolved.reference);
    let dest = path.join(this.config.registries[resolved.remote.registry].loc, resolved.name);
    return fs.symlink(src, dest);
  }

  /**
   * TODO description
   */

  async saveAll(deps: Array<string>): Promise<void> {
    deps = this.resolver.dedupePatterns(deps);
    let self = this;
    await promise.queue(deps, (dep) => self.save(dep));
  }
}

/**
 * TODO
 */

function hasSaveFlags(flags: Object): boolean {
  return flags.save || flags.saveDev || flags.saveExact || flags.saveOptional;
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
  if (args.length) {
    return shouldWriteLockfile(flags, args);
  } else {
    return false;
  }
}

/**
 * TODO
 */

function shouldWriteLockfile(flags: Object, args: Array<string>): boolean {
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
  commander.option("-f, --flat", "only allow one version of a package. save all transitive " +
                                 "dependencies as top level.");
  commander.option("-S, --save", "save package to your `dependencies`"); // TODO
  commander.option("-D, --save-dev", "save package to your `devDependencies`"); // TODO
  commander.option("-O, --save-optional", "save package to your `optionalDependencies`"); // TODO
  commander.option("-E, --save-exact", ""); // TODO
  commander.option("--tag [tag]", ""); // TODO
  commander.option("--dry-run", ""); // TODO
  commander.option("-f, --force", ""); // TODO
  commander.option("-g, --global", ""); // TODO
  commander.option("--link"); // TODO
  commander.option("--no-bin-links");
  commander.option("--no-optional"); // TODO
  commander.option("--no-lockfile"); // TODO
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>
): Promise<void> {
  if (hasSaveFlags(flags) && !args.length) {
    throw new MessageError("Missing package names for --save flags");
  }

  let lockfile = await Lockfile.fromDirectory(config.cwd, reporter, isStrictLockfile(flags, args));
  let install = new Install("install", flags, args, config, reporter, lockfile);
  return install.init();
}
