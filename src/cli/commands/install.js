/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type {ReporterSelectOption} from '../../reporters/types.js';
import type {Manifest, DependencyRequestPatterns} from '../../types.js';
import type Config from '../../config.js';
import type {RegistryNames} from '../../registries/index.js';
import normalizeManifest from '../../util/normalize-manifest/index.js';
import {stringify} from '../../util/misc.js';
import {registryNames} from '../../registries/index.js';
import {MessageError} from '../../errors.js';
import Lockfile from '../../lockfile/wrapper.js';
import executeLifecycleScript from './_execute-lifecycle-script.js';
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
import * as crypto from '../../util/crypto.js';
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
  [registryName: RegistryNames]: {
    loc: string,
    object: Object,
    exists: boolean,
  }
};

type IntegrityMatch = {
  actual: string,
  expected: string,
  loc: string,
  matches: boolean,
};

type Flags = {
  // install
  ignorePlatform: boolean,
  ignoreEngines: boolean,
  ignoreScripts: boolean,
  ignoreOptional: boolean,
  har: boolean,
  force: boolean,
  flat: boolean,
  production: boolean,
  lockfile: boolean,
  pureLockfile: boolean,
  skipIntegrity: boolean,

  // add
  peer: boolean,
  dev: boolean,
  optional: boolean,
  exact: boolean,
  tilde: boolean,
};

function normalizeFlags(config: Config, rawFlags: Object): Flags {
  const flags = {
    // install
    har: !!rawFlags.har,
    ignorePlatform: !!rawFlags.ignorePlatform,
    ignoreEngines: !!rawFlags.ignoreEngines,
    ignoreScripts: !!rawFlags.ignoreScripts,
    ignoreOptional: !!rawFlags.ignoreOptional,
    force: !!rawFlags.force,
    flat: !!rawFlags.flat,
    production: !!rawFlags.production,
    lockfile: rawFlags.lockfile !== false,
    pureLockfile: !!rawFlags.pureLockfile,
    skipIntegrity: !!rawFlags.skipIntegrity,

    // add
    peer: !!rawFlags.peer,
    dev: !!rawFlags.dev,
    optional: !!rawFlags.optional,
    exact: !!rawFlags.exact,
    tilde: !!rawFlags.tilde,
  };

  if (config.getOption('ignore-scripts')) {
    flags.ignoreScripts = true;
  }

  if (config.getOption('ignore-platform')) {
    flags.ignorePlatform = true;
  }

  if (config.getOption('ignore-engines')) {
    flags.ignoreEngines = true;
  }

  if (config.getOption('ignore-optional')) {
    flags.ignoreOptional = true;
  }

  if (config.getOption('force')) {
    flags.force = true;
  }

  if (config.getOption('production')) {
    flags.production = true;
  }

  return flags;
}

const sortObject = (object) => {
  const sortedObject = {};
  Object.keys(object).sort().forEach((item) => {
    sortedObject[item] = object[item];
  });
  return sortedObject;
};

export class Install {
  constructor(
    flags: Object,
    config: Config,
    reporter: Reporter,
    lockfile: Lockfile,
  ) {
    this.rootManifestRegistries = [];
    this.rootPatternsToOrigin = map();
    this.resolutions = map();
    this.lockfile = lockfile;
    this.reporter = reporter;
    this.config = config;
    this.flags = normalizeFlags(config, flags);

    this.resolver = new PackageResolver(config, lockfile);
    this.fetcher = new PackageFetcher(config, this.resolver);
    this.compatibility = new PackageCompatibility(config, this.resolver, this.flags.ignoreEngines);
    this.linker = new PackageLinker(config, this.resolver, this.flags.ignoreOptional);
    this.scripts = new PackageInstallScripts(config, this.resolver, this.flags.force);
  }

  flags: Flags;
  rootManifestRegistries: Array<RegistryNames>;
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
      const parts = PackageRequest.normalizePattern(pattern);
      excludeNames.push(parts.name);
    }

    for (const registry of Object.keys(registries)) {
      const {filename} = registries[registry];
      const loc = path.join(this.config.cwd, filename);
      if (!(await fs.exists(loc))) {
        continue;
      }

      this.rootManifestRegistries.push(registry);
      const json = await fs.readJson(loc);
      await normalizeManifest(json, this.config.cwd, this.config, true);

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

  async prepare(
    patterns: Array<string>,
    requests: DependencyRequestPatterns,
    match: IntegrityMatch,
  ): Promise<InstallPrepared> {
    if (!this.flags.skipIntegrity && !this.flags.force && match.matches) {
      this.reporter.success(this.reporter.lang('upToDate'));
      return {patterns, requests, skip: true};
    }

    if (!patterns.length && !match.expected) {
      this.reporter.success(this.reporter.lang('nothingToInstall'));
      await this.createEmptyManifestFolders();
      return {patterns, requests, skip: true};
    }

    return {patterns, requests, skip: false};
  }

  /**
   * Produce empty folders for all used root manifests.
   */

  async createEmptyManifestFolders(): Promise<void> {
    if (this.config.modulesFolder) {
      // already created
      return;
    }

    for (const registryName of this.rootManifestRegistries) {
      const {folder} = this.config.registries[registryName];
      await fs.mkdirp(path.join(this.config.cwd, folder));
    }
  }

  /**
   * TODO description
   */

  async init(): Promise<Array<string>> {
    let [depRequests, rawPatterns] = await this.fetchRequestFromCwd();
    const match = await this.matchesIntegrityHash(rawPatterns);

    const prepared = await this.prepare(rawPatterns, depRequests, match);
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
    const steps: Array<(curr: number, total: number) => Promise<void>> = [];

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

      if (this.flags.ignoreScripts) {
        this.reporter.warn(this.reporter.lang('ignoredScripts'));
      } else {
        await this.scripts.init(patterns);
      }
    });

    if (this.flags.har) {
      steps.push(async (curr: number, total: number) => {
        const formattedDate = new Date().toISOString().replace(/:/g, '-');
        const filename = `yarn-install_${formattedDate}.har`;
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
    for (const step of steps) {
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

    const flattenedPatterns = [];

    for (const name of this.resolver.getAllDependencyNamesByLevelOrder(patterns)) {
      const infos = this.resolver.getAllInfoForPackageName(name).filter((manifest: Manifest): boolean => {
        const ref = manifest._reference;
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
        const ref = info._reference;
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
      const jsons = await this.getRootManifests();

      for (const name in this.resolutions) {
        const version = this.resolutions[name];

        const patterns = this.resolver.patternsByPackage[name];
        if (!patterns) {
          continue;
        }

        let manifest;
        for (const pattern of patterns) {
          manifest = this.resolver.getResolvedPattern(pattern);
          if (manifest) {
            break;
          }
        }
        invariant(manifest, 'expected manifest');

        const ref = manifest._reference;
        invariant(ref, 'expected reference');

        const object = jsons[ref.registry].object;
        object.resolutions = object.resolutions || {};
        object.resolutions[name] = version;
      }

      await this.saveRootManifests(jsons);
    }

    return flattenedPatterns;
  }

  /**
   * Get root manifests.
   */

  async getRootManifests(): Promise<RootManifests> {
    const manifests: RootManifests = {};
    for (const registryName of registryNames) {
      const registry = registries[registryName];
      const jsonLoc = path.join(this.config.cwd, registry.filename);

      let object = {};
      let exists = false;
      if (await fs.exists(jsonLoc)) {
        exists = true;
        object = await fs.readJson(jsonLoc);
      }
      manifests[registryName] = {loc: jsonLoc, object, exists};
    }
    return manifests;
  }

  /**
   * Save root manifests.
   */

  async saveRootManifests(manifests: RootManifests): Promise<void> {
    for (const registryName of registryNames) {
      const {loc, object, exists} = manifests[registryName];
      if (!exists && !Object.keys(object).length) {
        continue;
      }

      for (const field of constants.DEPENDENCY_TYPES) {
        if (object[field]) {
          object[field] = sortObject(object[field]);
        }
      }

      await fs.writeFile(loc, stringify(object) + '\n');
    }
  }

  /**
   * Save updated integrity and lockfiles.
   */

  async saveLockfileAndIntegrity(patterns: Array<string>): Promise<void> {
    // stringify current lockfile
    const lockSource = lockStringify(this.lockfile.getLockfile(this.resolver.patterns)) + '\n';

    // write integrity hash
    await this.writeIntegrityHash(lockSource, patterns);

    // --no-lockfile or --pure-lockfile flag
    if (this.flags.lockfile === false || this.flags.pureLockfile) {
      return;
    }

    // check if the loaded lockfile has all the included patterns
    let inSync = true;
    for (const pattern of patterns) {
      if (!this.lockfile.getLocked(pattern)) {
        inSync = false;
        break;
      }
    }
    // check if loaded lockfile has patterns we don't have, eg. uninstall
    for (const pattern in this.lockfile.cache) {
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

    this._logSuccessSaveLockfile();
  }

  _logSuccessSaveLockfile() {
    this.reporter.success(this.reporter.lang('savedLockfile'));
  }

  /**
   * Check if the integrity hash of this installation matches one on disk.
   */

  async matchesIntegrityHash(patterns: Array<string>): Promise<IntegrityMatch> {
    const loc = await this.getIntegrityHashLocation();
    if (!await fs.exists(loc)) {
      return {
        actual: '',
        expected: '',
        loc,
        matches: false,
      };
    }

    const actual = this.generateIntegrityHash(this.lockfile.source, patterns);
    const expected = (await fs.readFile(loc)).trim();

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
    const possibleFolders = [];
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
    for (const name of checkRegistryNames) {
      const loc = path.join(this.config.cwd, this.config.registries[name].folder);
      possibleFolders.push(loc);
    }

    // if we already have an integrity hash in one of these folders then use it's location otherwise use the
    // first folder
    const possibles = possibleFolders.map((folder): string => path.join(folder, constants.INTEGRITY_FILENAME));
    let loc = possibles[0];
    for (const possibleLoc of possibles) {
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

  async writeIntegrityHash(lockSource: string, patterns: Array<string>): Promise<void> {
    const loc = await this.getIntegrityHashLocation();
    invariant(loc, 'expected integrity hash location');
    await fs.writeFile(loc, this.generateIntegrityHash(lockSource, patterns));
  }

  /**
   * Generate integrity hash of input lockfile.
   */

  generateIntegrityHash(lockfile: string, patterns: Array<string>): string {
    const opts = [lockfile];

    opts.push(`patterns:${patterns.join(',')}`);

    if (this.flags.flat) {
      opts.push('flat');
    }

    if (this.flags.production) {
      opts.push('production');
    }

    const linkedModules = this.config.linkedModules;
    if (linkedModules.length) {
      opts.push(`linked:${linkedModules.join(',')}`);
    }

    const mirror = this.config.getOfflineMirrorPath();
    if (mirror != null) {
      opts.push(`mirror:${mirror}`);
    }

    return crypto.hash(opts.join('-'), 'sha256');
  }
}

export function _setFlags(commander: Object) {
  commander.option('--har', 'save HAR output of network traffic');
  commander.option('--ignore-platform', 'ignore platform checks');
  commander.option('--ignore-engines', 'ignore engines check');
  commander.option('--ignore-scripts', '');
  commander.option('--ignore-optional', '');
  commander.option('--force', '');
  commander.option('--flat', 'only allow one version of a package');
  commander.option('--prod, --production', '');
  commander.option('--no-lockfile', "don't read or generate a lockfile");
  commander.option('--pure-lockfile', "don't generate a lockfile");
}

export function setFlags(commander: Object) {
  commander.usage('install [flags]');
  _setFlags(commander);

  commander.option('-g, --global', 'DEPRECATED');
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
    const exampleArgs = args.slice();
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
    let command = 'add';
    if (flags.global) {
      command = 'global add';
    }
    throw new MessageError(reporter.lang('installCommandRenamed', `yarn ${command} ${exampleArgs.join(' ')}`));
  }

  const install = new Install(flags, config, reporter, lockfile);
  await install.init();

  // npm behaviour, seems kinda funky but yay compatibility
  await executeLifecycleScript(config, 'prepublish');
}
