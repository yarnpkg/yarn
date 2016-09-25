/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type {ReporterSelectOption} from '../../reporters/types.js';
import type {Manifest, DependencyRequestPatterns} from '../../types.js';
import type Config from '../../config.js';
import type {RegistryNames} from '../../registries/index.js';
import normaliseManifest from '../../util/normalise-manifest/index.js';
import executeLifecycleScript from './_execute-lifecycle-script.js';
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
      await normaliseManifest(json, this.config.cwd, this.config, true);

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

    // inherit root flat flag
    if (manifest.flat) {
      this.flags.flat = true;
    }

    return [deps, patterns, manifest];
  }

  /**
   * TODO description
   */

  prepare(
    patterns: Array<string>,
    requests: DependencyRequestPatterns,
    match: IntegrityMatch,
  ): Promise<InstallPrepared> {
    if (!this.flags.force && match.matches) {
      this.reporter.success(this.reporter.lang('upToDate'));
      return Promise.resolve({patterns, requests, skip: true});
    }

    if (!patterns.length && !match.expected) {
      this.reporter.success(this.reporter.lang('nothingToInstall'));
      return Promise.resolve({patterns, requests, skip: true});
    }

    return Promise.resolve({patterns, requests, skip: false});
  }

  /**
   * TODO description
   */

  async init(): Promise<Array<string>> {
    let [depRequests, rawPatterns] = await this.fetchRequestFromCwd();
    let match = await this.matchesIntegrityHash();

    let prepared = await this.prepare(rawPatterns, depRequests, match);
    rawPatterns = prepared.patterns;
    depRequests = prepared.requests;
    if (prepared.skip) {
      return rawPatterns;
    }

    // remove integrity hash to make this operation atomic
    await fs.unlink(match.loc);

    // warn if we have a shrinkwrap
    if (await fs.exists(path.join(this.config.cwd, 'npm-shrinkwrap.json'))) {
      this.reporter.error(this.reporter.lang('shrinkwrapWarning'));
    }

    //
    let patterns = rawPatterns;
    let steps: Array<(curr: number, total: number) => Promise<void>> = [];

    steps.push(async (curr: number, total: number) => {
      this.reporter.step(curr, total, this.reporter.lang('resolvingPackages'), emoji.get('mag'));
      await this.resolver.init(depRequests, this.flags.flat);
      patterns = await this.flatten(rawPatterns);
    });

    steps.push(async (curr: number, total: number) => {
      this.reporter.step(curr, total, this.reporter.lang('fetchingPackages'), emoji.get('truck'));
      await this.fetcher.init();
      await this.compatibility.init();
    });

    steps.push(async (curr: number, total: number) => {
      this.reporter.step(curr, total, this.reporter.lang('linkingDependencies'), emoji.get('link'));
      await this.linker.init(patterns);
    });

    steps.push(async (curr: number, total: number) => {
      this.reporter.step(
        curr,
        total,
        this.flags.force ? this.reporter.lang('rebuildingPackages') : this.reporter.lang('buildingFreshPackages'),
        emoji.get('page_with_curl'),
      );
      await this.scripts.init(patterns);
    });

    if (this.flags.har) {
      steps.push(async (curr: number, total: number) => {
        const filename = `yarn-install_${new Date().toISOString()}.har`;
        this.reporter.step(
          curr,
          total,
          this.reporter.lang('savingHar', filename),
          emoji.get('black_circle_for_record'),
        );
        await this.config.requestManager.saveHar(filename);
      });
    }

    if (await this.shouldClean()) {
      steps.push(async (curr: number, total: number) => {
        this.reporter.step(curr, total, this.reporter.lang('cleaningModules'), emoji.get('recycle'));
        await clean(this.config, this.reporter);
      });
    }

    let currentStep = 0;
    for (let step of steps) {
      await step(++currentStep, steps.length);
    }

    // fin!
    await this.saveLockfileAndIntegrity(rawPatterns);
    this.config.requestManager.clearCache();
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

    let flattenedPatterns = [];

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
          // TODO `and is required by {PARENT}`,
          name: this.reporter.lang('manualVersionResolutionOption', ref.patterns.join(', '), info.version),

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
          this.reporter.lang('manualVersionResolution', name),
          this.reporter.lang('answer'),
          options,
        );
        this.resolutions[name] = version;
      }

      flattenedPatterns.push(this.resolver.collapseAllVersionsOfPackage(name, version));
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

    return flattenedPatterns;
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

  async saveRootManifests(jsons: RootManifests): Promise<void> {
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

  async saveLockfileAndIntegrity(patterns: Array<string>): Promise<void> {
    // stringify current lockfile
    const lockSource = lockStringify(this.lockfile.getLockfile(this.resolver.patterns)) + '\n';

    // write integrity hash
    await this.writeIntegrityHash(lockSource);

    // --no-lockfile or --pure-lockfile flag
    if (this.flags.lockfile === false || this.flags.pureLockfile) {
      return;
    }

    // check if the loaded lockfile has all the included patterns
    let inSync = true;
    for (let pattern of patterns) {
      if (!this.lockfile.getLocked(pattern)) {
        inSync = false;
        break;
      }
    }
    // check if loaded lockfile has patterns we don't have, eg. uninstall
    for (let pattern in this.lockfile.cache) {
      if (patterns.indexOf(pattern) === -1) {
        inSync = false;
        break;
      }
    }
    // don't write new lockfile if in sync
    if (inSync) {
      return;
    }

    // build lockfile location
    const loc = path.join(this.config.cwd, constants.LOCKFILE_FILENAME);

    // write lockfile
    await fs.writeFile(loc, lockSource);

    this.reporter.success(this.reporter.lang('savedLockfile'));
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

    let mirror = this.config.getOfflineMirrorPath();
    if (mirror != null) {
      opts.push(`mirror:${mirror}`);
    }

    return util.hash(opts.join(':'));
  }
}

export function setFlags(commander: Object) {
  commander.usage('install [flags]');
  commander.option('--force', '');
  commander.option('--flat', 'only allow one version of a package');
  commander.option('--prod, --production', '');
  commander.option('--no-lockfile', "don't read or generate a lockfile");
  commander.option('--pure-lockfile', "don't generate a lockfile");

  commander.option('-S, --save', 'DEPRECATED - save package to your `dependencies`');
  commander.option('-D, --save-dev', 'DEPRECATED - save package to your `devDependencies`');
  commander.option('-P, --save-peer', 'DEPRECATED - save package to your `peerDependencies`');
  commander.option('-O, --save-optional', 'DEPRECATED - save package to your `optionalDependencies`');
  commander.option('-E, --save-exact', 'DEPRECATED');
  commander.option('-T, --save-tilde', 'DEPRECATED');
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
    reporter.error(reporter.lang('installCommandRenamed'));
    reporter.command(`yarn add ${exampleArgs.join(' ')}`);
    return Promise.reject();
  }

  const install = new Install(flags, config, reporter, lockfile);
  await install.init();

  // npm behaviour, seems kinda funky but yay compatibility
  await executeLifecycleScript(config, 'prepublish');

  return Promise.resolve();
}
