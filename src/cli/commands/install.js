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

import type {Reporter} from '../../reporters/index.js';
import type {ReporterSelectOption} from '../../reporters/types.js';
import type {Manifest, DependencyRequestPatterns} from '../../types.js';
import type Config from '../../config.js';
import type {RegistryNames} from '../../registries/index.js';
import {stringify} from '../../util/misc.js';
import {registryNames} from '../../registries/index.js';
import Lockfile from '../../lockfile/wrapper.js';
import lockStringify from '../../lockfile/stringify.js';
import * as PackageReference from '../../package-reference.js';
import PackageFetcher from '../../package-fetcher.js';
import PackageInstallScripts from '../../package-install-scripts.js';
import PackageCompatibility from '../../package-compatibility.js';
import PackageResolver from '../../package-resolver.js';
import PackageLinker from '../../package-linker.js';
import PackageRequest from '../../package-request.js';
import {registries} from '../../registries/index.js';
import {clean} from './clean.js';
import * as constants from '../../constants.js';
import * as fs from '../../util/fs.js';
import * as util from '../../util/misc.js';
import map from '../../util/map.js';

const invariant = require('invariant');
const emoji = require('node-emoji');
const path = require('path');

export type InstallPrepared = {
  skip: boolean,
  requests: DependencyRequestPatterns,
  patterns: Array<string>,
};

export type InstallCwdRequest = [
  DependencyRequestPatterns,
  Array<string>,
  Object
];

type RootManifests = {
  [registryName: RegistryNames]: [string, Object]
};

type IntegrityMatch = {
  actual: string,
  expected: string,
  loc: string,
  matches: boolean,
};

export class Install {
  constructor(
    flags: Object,
    config: Config,
    reporter: Reporter,
    lockfile: Lockfile,
  ) {
    this.rootPatternsToOrigin = map();
    this.resolutions = map();
    this.lockfile = lockfile;
    this.reporter = reporter;
    this.config = config;
    this.flags = flags;

    this.resolver = new PackageResolver(config, lockfile);
    this.fetcher = new PackageFetcher(config, this.resolver);
    this.compatibility = new PackageCompatibility(config, this.resolver);
    this.linker = new PackageLinker(config, this.resolver);
    this.scripts = new PackageInstallScripts(config, this.resolver, flags.force);
  }

  flags: Object;
  registries: Array<RegistryNames>;
  lockfile: Lockfile;
  resolutions: { [packageName: string]: string };
  config: Config;
  reporter: Reporter;
  resolver: PackageResolver;
  scripts: PackageInstallScripts;
  linker: PackageLinker;
  compatibility: PackageCompatibility;
  fetcher: PackageFetcher;
  rootPatternsToOrigin: { [pattern: string]: string };

  /**
   * Create a list of dependency requests from the current directories manifests.
   */

  async fetchRequestFromCwd(excludePatterns?: Array<string> = []): Promise<InstallCwdRequest> {
    const patterns = [];
    const deps = [];
    const manifest = {};

    // exclude package names that are in install args
    const excludeNames = [];
    for (const pattern of excludePatterns) {
      // can't extract a package name from this
      if (PackageRequest.getExoticResolver(pattern)) {
        continue;
      }

      // extract the name
      const parts = PackageRequest.normalisePattern(pattern);
      excludeNames.push(parts.name);
    }

    for (const registry of Object.keys(registries)) {
      const {filename} = registries[registry];
      const loc = path.join(this.config.cwd, filename);
      if (!(await fs.exists(loc))) {
        continue;
      }

      const json = await fs.readJson(loc);
      Object.assign(this.resolutions, json.resolutions);
      Object.assign(manifest, json);

      const pushDeps = (depType, {hint, visibility, optional}) => {
        const depMap = json[depType];
        for (const name in depMap) {
          if (excludeNames.indexOf(name) >= 0) {
            continue;
          }

          let pattern = name;
          if (!this.lockfile.getLocked(pattern, true)) {
            // when we use --save we save the dependency to the lockfile with just the name rather than the
            // version combo
            pattern += '@' + depMap[name];
          }

          this.rootPatternsToOrigin[pattern] = depType;
          patterns.push(pattern);
          deps.push({pattern, registry, visibility, hint, optional});
        }
      };

      pushDeps('dependencies', {hint: null, visibility: PackageReference.USED, optional: false});

      const devVisibility = this.flags.production ? PackageReference.ENVIRONMENT_IGNORE : PackageReference.USED;
      pushDeps('devDependencies', {hint: 'dev', visibility: devVisibility, optional: false});

      pushDeps('optionalDependencies', {hint: 'optional', visibility: PackageReference.USED, optional: true});

      break;
    }

    return [deps, patterns, manifest];
  }

  /**
   * TODO description
   */

  async prepare(
    patterns: Array<string>,
    requests: DependencyRequestPatterns,
    match: IntegrityMatch,
  ): Promise<InstallPrepared> {
    if (!this.flags.force && match.matches) {
      this.reporter.success('Already up-to-date.');
      return {patterns, requests, skip: true};
    }

    return {patterns, requests, skip: false};
  }

  /**
   * TODO description
   */

  async init(): Promise<Array<string>> {
    let [depRequests, rawPatterns, manifest] = await this.fetchRequestFromCwd();
    if (manifest.flat) {
      this.flags.flat = true;
    }
    let match = await this.matchesIntegrityHash();

    let prepared = await this.prepare(rawPatterns, depRequests, match);
    rawPatterns = prepared.patterns;
    depRequests = prepared.requests;
    if (prepared.skip) {
      return rawPatterns;
    }

    // remove integrity hash to make this operation atomic
    await fs.unlink(match.loc);

    //
    let patterns = rawPatterns;
    let steps: Array<(curr: number, total: number) => Promise<void>> = [];

    steps.push(async (curr: number, total: number) => {
      this.reporter.step(curr, total, 'Resolving packages', emoji.get('mag'));
      await this.resolver.init(depRequests, this.flags.flat);
      patterns = await this.flatten(rawPatterns);
    });

    steps.push(async (curr: number, total: number) => {
      this.reporter.step(curr, total, 'Fetching packages', emoji.get('truck'));
      await this.fetcher.init();
      await this.compatibility.init();
    });

    steps.push(async (curr: number, total: number) => {
      this.reporter.step(curr, total, 'Linking dependencies', emoji.get('link'));
      await this.linker.init(patterns);
    });

    steps.push(async (curr: number, total: number) => {
      this.reporter.step(
        curr,
        total,
        this.flags.force ? 'Rebuilding all packages' : 'Building fresh packages',
        emoji.get('page_with_curl'),
      );
      await this.scripts.init(patterns);
    });

    if (await this.shouldClean()) {
      steps.push(async (curr: number, total: number) => {
        this.reporter.step(curr, total, 'Cleaning modules', emoji.get('recycle'));
        await clean(this.config, this.reporter);
      });
    }

    let currentStep = 0;
    for (let step of steps) {
      await step(++currentStep, steps.length);
    }

    // fin!
    await this.saveLockfileAndIntegrity();
    return patterns;
  }

  /**
   * Check if we should run the cleaning step.
   */

  shouldClean(): Promise<boolean> {
    return fs.exists(path.join(this.config.cwd, constants.CLEAN_FILENAME));
  }

  /**
   * TODO
   */

  async flatten(patterns: Array<string>): Promise<Array<string>> {
    if (!this.flags.flat) {
      return patterns;
    }

    for (const name of this.resolver.getAllDependencyNamesByLevelOrder(patterns)) {
      const infos = this.resolver.getAllInfoForPackageName(name).filter((manifest: Manifest): boolean => {
        let ref = manifest._reference;
        invariant(ref, 'expected package reference');
        return !ref.ignore;
      });

      if (infos.length === 0) {
        continue;
      }

      if (infos.length === 1) {
        // single version of this package
        // take out a single pattern as multiple patterns may have resolved to this package
        patterns.push(this.resolver.patternsByPackage[name][0]);
        continue;
      }

      const options = infos.map((info): ReporterSelectOption => {
        let ref = info._reference;
        invariant(ref, 'expected reference');
        return {
          name: `${ref.patterns.join(', ')} which resolved to ${info.version}`, // TODO `and is required by {PARENT}`,
          value: info.version,
        };
      });
      const versions = infos.map((info): string => info.version);
      let version: ?string;

      const resolutionVersion = this.resolutions[name];
      if (resolutionVersion && versions.indexOf(resolutionVersion) >= 0) {
        // use json `resolution` version
        version = resolutionVersion;
      } else {
        version = await this.reporter.select(
          `Unable to find a suitable version for ${name}, please choose one by typing one of the numbers below:`,
          'Answer',
          options,
        );
        this.resolutions[name] = version;
      }

      patterns.push(this.resolver.collapseAllVersionsOfPackage(name, version));
    }

    // save resolutions to their appropriate root manifest
    if (Object.keys(this.resolutions).length) {
      let jsons = await this.getRootManifests();

      for (let name in this.resolutions) {
        let version = this.resolutions[name];

        let patterns = this.resolver.patternsByPackage[name];
        if (!patterns) {
          continue;
        }

        let manifest;
        for (let pattern of patterns) {
          manifest = this.resolver.getResolvedPattern(pattern);
          if (manifest) {
            break;
          }
        }
        invariant(manifest, 'expected manifest');

        let ref = manifest._reference;
        invariant(ref, 'expected reference');

        let json = jsons[ref.registry][1];
        json.resolutions = json.resolutions || {};
        json.resolutions[name] = version;
      }

      await this.saveRootManifests(jsons);
    }

    return patterns;
  }

  /**
   * Get root manifests.
   */

  async getRootManifests(): Promise<RootManifests> {
    let jsons: RootManifests = {};
    for (let registryName of registryNames) {
      const registry = registries[registryName];
      const jsonLoc = path.join(this.config.cwd, registry.filename);

      let json = {};
      if (await fs.exists(jsonLoc)) {
        json = await fs.readJson(jsonLoc);
      }
      jsons[registryName] = [jsonLoc, json];
    }
    return jsons;
  }

  /**
   * Save root manifests.
   */

  async saveRootManifests(jsons: RootManifests) {
    for (let registryName of registryNames) {
      let [loc, json] = jsons[registryName];
      if (!Object.keys(json).length) {
        continue;
      }

      await fs.writeFile(loc, stringify(json) + '\n');
    }
  }

  /**
   * Save updated integrity and lockfiles.
   */

  async saveLockfileAndIntegrity(): Promise<void> {
    // stringify current lockfile
    const lockSource = lockStringify(this.lockfile.getLockfile(this.resolver.patterns)) + '\n';

    // write integrity hash
    await this.writeIntegrityHash(lockSource);

    // --no-lockfile flag
    if (this.flags.lockfile === false) {
      return;
    }

    // build lockfile location
    const loc = path.join(this.config.cwd, constants.LOCKFILE_FILENAME);

    // write lockfile
    await fs.writeFile(loc, lockSource);

    this.reporter.success(`Saved lockfile.`);
  }

  /**
   * Check if the integrity hash of this installation matches one on disk.
   */

  async matchesIntegrityHash(): Promise<IntegrityMatch> {
    let loc = await this.getIntegrityHashLocation();
    if (!await fs.exists(loc)) {
      return {
        actual: '',
        expected: '',
        loc,
        matches: false,
      };
    }

    let actual = this.generateIntegrityHash(this.lockfile.source);
    let expected = (await fs.readFile(loc)).trim();

    return {
      actual,
      expected,
      loc,
      matches: actual === expected,
    };
  }

  /**
   * Get the location of an existing integrity hash. If none exists then return the location where we should
   * write a new one.
   */

  async getIntegrityHashLocation(): Promise<string> {
    // build up possible folders
    let possibleFolders = [];
    if (this.config.modulesFolder) {
      possibleFolders.push(this.config.modulesFolder);
    }

    // get a list of registry names to check existence in
    let checkRegistryNames = this.resolver.usedRegistries;
    if (!checkRegistryNames.length) {
      // we haven't used any registries yet
      checkRegistryNames = registryNames;
    }

    // ensure we only write to a registry folder that was used
    for (let name of checkRegistryNames) {
      let loc = path.join(this.config.cwd, this.config.registries[name].folder);
      possibleFolders.push(loc);
    }

    // if we already have an integrity hash in one of these folders then use it's location otherwise use the
    // first folder
    let possibles = possibleFolders.map((folder): string => path.join(folder, constants.INTEGRITY_FILENAME));
    let loc = possibles[0];
    for (let possibleLoc of possibles) {
      if (await fs.exists(possibleLoc)) {
        loc = possibleLoc;
        break;
      }
    }
    return loc;
  }
  /**
   * Write the integrity hash of the current install to disk.
   */

  async writeIntegrityHash(lockSource: string): Promise<void> {
    let loc = await this.getIntegrityHashLocation();
    invariant(loc, 'expected integrity hash location');
    await fs.writeFile(loc, this.generateIntegrityHash(lockSource));
  }

  /**
   * Generate integrity hash of input lockfile.
   */

  generateIntegrityHash(lockfile: string): string {
    let opts = [lockfile];
    if (this.flags.flat) {
      opts.push('flat');
    }
    if (this.flags.production) {
      opts.push('production');
    }
    return util.hash(opts.join(':'));
  }
}

export function setFlags(commander: Object) {
  commander.usage('install [flags]');
  commander.option('--force', '');
  commander.option('-f, --flat', 'only allow one version of a package');
  commander.option('-S, --save', 'DEPRECATED - save package to your `dependencies`');
  commander.option('-D, --save-dev', 'DEPRECATED - save package to your `devDependencies`');
  commander.option('-P, --save-peer', 'DEPRECATED - save package to your `peerDependencies`');
  commander.option('-O, --save-optional', 'DEPRECATED - save package to your `optionalDependencies`');
  commander.option('-E, --save-exact', 'DEPRECATED');
  commander.option('-T, --save-tilde', 'DEPRECATED');
  commander.option('--prod, --production', '');
  commander.option('--no-lockfile');
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  let lockfile;
  if (flags.lockfile === false) {
    lockfile = new Lockfile();
  } else {
    lockfile = await Lockfile.fromDirectory(config.cwd, reporter);
  }

  if (args.length) {
    let exampleArgs = args.slice();
    if (flags.saveDev) {
      exampleArgs.push('--dev');
    }
    if (flags.savePeer) {
      exampleArgs.push('--peer');
    }
    if (flags.saveOptional) {
      exampleArgs.push('--optional');
    }
    if (flags.saveExact) {
      exampleArgs.push('--exact');
    }
    if (flags.saveTilde) {
      exampleArgs.push('--tilde');
    }
    reporter.info('`install` has been replaced with `add` to add new dependencies.');
    reporter.command(`kpm add ${exampleArgs.join(' ')}`);
    return Promise.reject();
  }

  const install = new Install(flags, config, reporter, lockfile);
  await install.init();
  return Promise.resolve();
}
