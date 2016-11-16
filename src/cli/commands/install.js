/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type {ReporterSelectOption} from '../../reporters/types.js';
import type {Manifest, DependencyRequestPatterns} from '../../types.js';
import type Config from '../../config.js';
import type {RegistryNames} from '../../registries/index.js';
import normalizeManifest from '../../util/normalize-manifest/index.js';
import {registryNames} from '../../registries/index.js';
import {MessageError} from '../../errors.js';
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
import * as crypto from '../../util/crypto.js';
import map from '../../util/map.js';
import {sortAlpha} from '../../util/misc.js';

const invariant = require('invariant');
const userHome = require('user-home');
const semver = require('semver');
const emoji = require('node-emoji');
const isCI = require('is-ci');
const path = require('path');
const fs2 = require('fs');

const {version: YARN_VERSION, installationMethod: YARN_INSTALL_METHOD} = require('../../../package.json');
const ONE_DAY = 1000 * 60 * 60 * 24;

export type InstallCwdRequest = [
  DependencyRequestPatterns,
  Array<string>,
  Object
];

export type IntegrityMatch = {
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

/**
 * Try and detect the installation method for Yarn and provide a command to update it with.
 */

function getUpdateCommand(): ?string {
  if (YARN_INSTALL_METHOD === 'tar') {
    return 'curl -o- -L https://yarnpkg.com/install.sh | bash';
  }

  if (YARN_INSTALL_METHOD === 'homebrew') {
    return 'brew upgrade yarn';
  }

  if (YARN_INSTALL_METHOD === 'deb') {
    return 'sudo apt-get update && sudo apt-get install yarn';
  }

  if (YARN_INSTALL_METHOD === 'rpm') {
    return 'sudo yum install yarn';
  }

  if (YARN_INSTALL_METHOD === 'npm') {
    return 'npm upgrade --global yarn';
  }

  if (YARN_INSTALL_METHOD === 'chocolatey') {
      return 'choco upgrade yarn';
  }

  return null;
}

function getUpdateInstaller(): ?string {
  // Windows
  if (YARN_INSTALL_METHOD === 'msi') {
    return 'https://yarnpkg.com/latest.msi';
  }

  return null;
}

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

  if (config.getOption('production') || process.env.NODE_ENV === 'production') {
    flags.production = true;
  }

  return flags;
}

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
      const json = await this.config.readJson(loc);
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

  prepareRequests(requests: DependencyRequestPatterns): DependencyRequestPatterns {
    return requests;
  }

  preparePatterns(
    patterns: Array<string>,
  ): Array<string> {
    return patterns;
  }

  async bailout(
    patterns: Array<string>,
  ): Promise<boolean> {
    const match = await this.matchesIntegrityHash(patterns);
    const haveLockfile = await fs.exists(path.join(this.config.cwd, constants.LOCKFILE_FILENAME));

    if (!this.flags.skipIntegrity && !this.flags.force && match.matches && haveLockfile) {
      this.reporter.success(this.reporter.lang('upToDate'));
      return true;
    }

    if (!patterns.length && !match.expected) {
      this.reporter.success(this.reporter.lang('nothingToInstall'));
      await this.createEmptyManifestFolders();
      return true;
    }

    return false;
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
    this.checkUpdate();

    // warn if we have a shrinkwrap
    if (await fs.exists(path.join(this.config.cwd, 'npm-shrinkwrap.json'))) {
      this.reporter.error(this.reporter.lang('shrinkwrapWarning'));
    }

    let patterns: Array<string> = [];
    const steps: Array<(curr: number, total: number) => Promise<{bailout: boolean} | void>> = [];
    const [depRequests, rawPatterns] = await this.fetchRequestFromCwd();

    steps.push(async (curr: number, total: number) => {
      this.reporter.step(curr, total, this.reporter.lang('resolvingPackages'), emoji.get('mag'));
      await this.resolver.init(this.prepareRequests(depRequests), this.flags.flat);
      patterns = await this.flatten(this.preparePatterns(rawPatterns));
      return {bailout: await this.bailout(patterns)};
    });


    steps.push(async (curr: number, total: number) => {
      this.reporter.step(curr, total, this.reporter.lang('fetchingPackages'), emoji.get('truck'));
      await this.fetcher.init();
      await this.compatibility.init();
    });

    steps.push(async (curr: number, total: number) => {
      // remove integrity hash to make this operation atomic
      const loc = await this.getIntegrityHashLocation();
      await fs.unlink(loc);
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
      const stepResult = await step(++currentStep, steps.length);
      if (stepResult && stepResult.bailout) {
        return patterns;
      }
    }

    // fin!
    await this.saveLockfileAndIntegrity(patterns);
    this.maybeOutputUpdate();
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
        flattenedPatterns.push(this.resolver.patternsByPackage[name][0]);
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
      const manifests = await this.config.getRootManifests();

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

        const object = manifests[ref.registry].object;
        object.resolutions = object.resolutions || {};
        object.resolutions[name] = version;
      }

      await this.config.saveRootManifests(manifests);
    }

    return flattenedPatterns;
  }

  /**
   * Save updated integrity and lockfiles.
   */

  async saveLockfileAndIntegrity(patterns: Array<string>): Promise<void> {
    // stringify current lockfile
    const lockSource = lockStringify(this.lockfile.getLockfile(this.resolver.patterns));

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

    // remove is followed by install with force on which we rewrite lockfile
    if (inSync && !this.flags.force) {
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

    const lockSource = lockStringify(this.lockfile.getLockfile(this.resolver.patterns));
    const actual = this.generateIntegrityHash(lockSource, patterns);
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

    opts.push(`patterns:${patterns.sort(sortAlpha).join(',')}`);

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

  /**
   * Load the dependency graph of the current install. Only does package resolving and wont write to the cwd.
   */

  async hydrate(fetch?: boolean): Promise<InstallCwdRequest> {
    const request = await this.fetchRequestFromCwd();
    const [depRequests, rawPatterns] = request;

    await this.resolver.init(depRequests, this.flags.flat);
    await this.flatten(rawPatterns);

    if (fetch) {
      // fetch packages, should hit cache most of the time
      await this.fetcher.init();

      // expand minimal manifests
      for (const manifest of this.resolver.getManifests()) {
        const ref = manifest._reference;
        invariant(ref, 'expected reference');

        const loc = this.config.generateHardModulePath(ref);
        const newPkg = await this.config.readManifest(loc);
        await this.resolver.updateManifest(ref, newPkg);
      }
    }

    return request;
  }

  /**
   * Check for updates every day and output a nag message if there's a newer version.
   */

  checkUpdate() {
    if (!process.stdout.isTTY || isCI) {
      // don't show upgrade dialog on CI or non-TTY terminals
      return;
    }

    // only check for updates once a day
    const lastUpdateCheck = Number(this.config.getOption('lastUpdateCheck')) || 0;
    if (lastUpdateCheck && Date.now() - lastUpdateCheck < ONE_DAY) {
      return;
    }

    // don't bug for updates on tagged releases
    if (YARN_VERSION.indexOf('-') >= 0) {
      return;
    }

    this._checkUpdate().catch(() => {
      // swallow errors
    });
  }

  async _checkUpdate(): Promise<void> {
    let latestVersion = await this.config.requestManager.request({
      url: 'https://yarnpkg.com/latest-version',
    });
    invariant(typeof latestVersion === 'string', 'expected string');
    latestVersion = latestVersion.trim();
    if (!semver.valid(latestVersion)) {
      return;
    }

    // ensure we only check for updates periodically
    this.config.registries.yarn.saveHomeConfig({
      lastUpdateCheck: Date.now(),
    });

    if (semver.gt(latestVersion, YARN_VERSION)) {
      this.maybeOutputUpdate = () => {
        this.reporter.warn(this.reporter.lang('yarnOutdated', latestVersion, YARN_VERSION));

        const command = getUpdateCommand();
        if (command) {
          this.reporter.info(this.reporter.lang('yarnOutdatedCommand'));
          this.reporter.command(command);
        } else {
          const installer = getUpdateInstaller();
          if (installer) {
            this.reporter.info(this.reporter.lang('yarnOutdatedInstaller', installer));
          }
        }
      };
    }
  }

  /**
   * Method to override with a possible upgrade message.
   */

  maybeOutputUpdate() {}
  maybeOutputUpdate: any;
}

export function setFlags(commander: Object) {
  commander.usage('install [flags]');
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

  await wrapLifecycle(config, flags, async () => {
    const install = new Install(flags, config, reporter, lockfile);
    await install.init();
  });
}

export async function wrapLifecycle(config: Config, flags: Object, factory: () => Promise<void>): Promise<void> {
  await config.executeLifecycleScript('preinstall');

  await factory();

  // npm behaviour, seems kinda funky but yay compatibility
  await config.executeLifecycleScript('install');
  await config.executeLifecycleScript('postinstall');

  if (!flags.production) {
    await config.executeLifecycleScript('prepublish');
  }
}
