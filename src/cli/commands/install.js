/* @flow */

import type {InstallationMethod} from '../../util/yarn-version.js';
import type {Reporter} from '../../reporters/index.js';
import type {ReporterSelectOption} from '../../reporters/types.js';
import type {Manifest, DependencyRequestPatterns} from '../../types.js';
import type Config from '../../config.js';
import type {RegistryNames} from '../../registries/index.js';
import normalizeManifest from '../../util/normalize-manifest/index.js';
import {MessageError} from '../../errors.js';
import InstallationIntegrityChecker from '../../integrity-checker.js';
import Lockfile from '../../lockfile/wrapper.js';
import lockStringify from '../../lockfile/stringify.js';
import * as fetcher from '../../package-fetcher.js';
import PackageInstallScripts from '../../package-install-scripts.js';
import * as compatibility from '../../package-compatibility.js';
import PackageResolver from '../../package-resolver.js';
import PackageLinker from '../../package-linker.js';
import PackageRequest from '../../package-request.js';
import {registries} from '../../registries/index.js';
import {clean} from './clean.js';
import * as constants from '../../constants.js';
import * as fs from '../../util/fs.js';
import map from '../../util/map.js';
import {version as YARN_VERSION, getInstallationMethod} from '../../util/yarn-version.js';
import WorkspaceLayout from '../../workspace-layout.js';

const emoji = require('node-emoji');
const invariant = require('invariant');
const isCI = require('is-ci');
const path = require('path');
const semver = require('semver');
const uuid = require('uuid');

const ONE_DAY = 1000 * 60 * 60 * 24;

export type InstallCwdRequest = {
  requests: DependencyRequestPatterns,
  patterns: Array<string>,
  ignorePatterns: Array<string>,
  usedPatterns: Array<string>,
  manifest: Object,
  workspaceLayout?: WorkspaceLayout,
};

type Flags = {
  // install
  har: boolean,
  ignorePlatform: boolean,
  ignoreEngines: boolean,
  ignoreScripts: boolean,
  ignoreOptional: boolean,
  linkDuplicates: boolean,
  force: boolean,
  flat: boolean,
  lockfile: boolean,
  pureLockfile: boolean,
  frozenLockfile: boolean,
  skipIntegrityCheck: boolean,
  checkFiles: boolean,

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

function getUpdateCommand(installationMethod: InstallationMethod): ?string {
  if (installationMethod === 'tar') {
    return `curl -o- -L ${constants.YARN_INSTALLER_SH} | bash`;
  }

  if (installationMethod === 'homebrew') {
    return 'brew upgrade yarn';
  }

  if (installationMethod === 'deb') {
    return 'sudo apt-get update && sudo apt-get install yarn';
  }

  if (installationMethod === 'rpm') {
    return 'sudo yum install yarn';
  }

  if (installationMethod === 'npm') {
    return 'npm upgrade --global yarn';
  }

  if (installationMethod === 'chocolatey') {
    return 'choco upgrade yarn';
  }

  if (installationMethod === 'apk') {
    return 'apk update && apk add -u yarn';
  }

  return null;
}

function getUpdateInstaller(installationMethod: InstallationMethod): ?string {
  // Windows
  if (installationMethod === 'msi') {
    return constants.YARN_INSTALLER_MSI;
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
    lockfile: rawFlags.lockfile !== false,
    pureLockfile: !!rawFlags.pureLockfile,
    skipIntegrityCheck: !!rawFlags.skipIntegrityCheck,
    frozenLockfile: !!rawFlags.frozenLockfile,
    linkDuplicates: !!rawFlags.linkDuplicates,
    checkFiles: !!rawFlags.checkFiles,

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

  return flags;
}

export class Install {
  constructor(flags: Object, config: Config, reporter: Reporter, lockfile: Lockfile) {
    this.rootManifestRegistries = [];
    this.rootPatternsToOrigin = map();
    this.resolutions = map();
    this.lockfile = lockfile;
    this.reporter = reporter;
    this.config = config;
    this.flags = normalizeFlags(config, flags);

    this.resolver = new PackageResolver(config, lockfile);
    this.integrityChecker = new InstallationIntegrityChecker(config);
    this.linker = new PackageLinker(config, this.resolver);
    this.scripts = new PackageInstallScripts(config, this.resolver, this.flags.force);
  }

  flags: Flags;
  rootManifestRegistries: Array<RegistryNames>;
  registries: Array<RegistryNames>;
  lockfile: Lockfile;
  resolutions: {[packageName: string]: string};
  config: Config;
  reporter: Reporter;
  resolver: PackageResolver;
  scripts: PackageInstallScripts;
  linker: PackageLinker;
  rootPatternsToOrigin: {[pattern: string]: string};
  integrityChecker: InstallationIntegrityChecker;

  /**
   * Create a list of dependency requests from the current directories manifests.
   */

  async fetchRequestFromCwd(
    excludePatterns?: Array<string> = [],
    ignoreUnusedPatterns?: boolean = false,
  ): Promise<InstallCwdRequest> {
    const patterns = [];
    const deps: DependencyRequestPatterns = [];
    const manifest = {};

    const ignorePatterns = [];
    const usedPatterns = [];
    let workspaceLayout;

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
      if (!await fs.exists(loc)) {
        continue;
      }

      this.rootManifestRegistries.push(registry);
      const projectManifestJson = await this.config.readJson(loc);
      await normalizeManifest(projectManifestJson, this.config.cwd, this.config, true);

      Object.assign(this.resolutions, projectManifestJson.resolutions);
      Object.assign(manifest, projectManifestJson);

      const pushDeps = (depType, manifest: Object, {hint, optional}, isUsed) => {
        if (ignoreUnusedPatterns && !isUsed) {
          return;
        }
        // We only take unused dependencies into consideration to get deterministic hoisting.
        // Since flat mode doesn't care about hoisting and everything is top level and specified then we can safely
        // leave these out.
        if (this.flags.flat && !isUsed) {
          return;
        }
        const depMap = manifest[depType];
        for (const name in depMap) {
          if (excludeNames.indexOf(name) >= 0) {
            continue;
          }

          let pattern = name;
          if (!this.lockfile.getLocked(pattern)) {
            // when we use --save we save the dependency to the lockfile with just the name rather than the
            // version combo
            pattern += '@' + depMap[name];
          }

          // normalization made sure packages are mentioned only once
          if (isUsed) {
            usedPatterns.push(pattern);
          } else {
            ignorePatterns.push(pattern);
          }

          this.rootPatternsToOrigin[pattern] = depType;
          patterns.push(pattern);
          deps.push({pattern, registry, hint, optional});
        }
      };

      pushDeps('dependencies', projectManifestJson, {hint: null, optional: false}, true);
      pushDeps('devDependencies', projectManifestJson, {hint: 'dev', optional: false}, !this.config.production);
      pushDeps(
        'optionalDependencies',
        projectManifestJson,
        {hint: 'optional', optional: true},
        !this.flags.ignoreOptional,
      );

      if (this.config.workspacesEnabled) {
        const workspaces = await this.config.resolveWorkspaces(path.dirname(loc), projectManifestJson);
        workspaceLayout = new WorkspaceLayout(workspaces, this.config);
        // add virtual manifest that depends on all workspaces, this way package hoisters and resolvers will work fine
        const virtualDependencyManifest: Manifest = {
          _uid: '',
          name: `workspace-aggregator-${uuid.v4()}`,
          version: '1.0.0',
          _registry: 'npm',
          _loc: '.',
          dependencies: {},
        };
        workspaceLayout.virtualManifestName = virtualDependencyManifest.name;
        virtualDependencyManifest.dependencies = {};
        for (const workspaceName of Object.keys(workspaces)) {
          virtualDependencyManifest.dependencies[workspaceName] = workspaces[workspaceName].manifest.version;
        }
        const virtualDep = {};
        virtualDep[virtualDependencyManifest.name] = virtualDependencyManifest.version;
        workspaces[virtualDependencyManifest.name] = {loc: '', manifest: virtualDependencyManifest};

        pushDeps('workspaces', {workspaces: virtualDep}, {hint: 'workspaces', optional: false}, true);
      }

      break;
    }

    // inherit root flat flag
    if (manifest.flat) {
      this.flags.flat = true;
    }

    return {
      requests: deps,
      patterns,
      manifest,
      usedPatterns,
      ignorePatterns,
      workspaceLayout,
    };
  }

  /**
   * TODO description
   */

  prepareRequests(requests: DependencyRequestPatterns): DependencyRequestPatterns {
    return requests;
  }

  preparePatterns(patterns: Array<string>): Array<string> {
    return patterns;
  }

  async bailout(patterns: Array<string>, workspaceLayout: ?WorkspaceLayout): Promise<boolean> {
    if (this.flags.skipIntegrityCheck || this.flags.force) {
      return false;
    }
    const lockfileCache = this.lockfile.cache;
    if (!lockfileCache) {
      return false;
    }
    const match = await this.integrityChecker.check(patterns, lockfileCache, this.flags, workspaceLayout);
    if (this.flags.frozenLockfile && match.missingPatterns.length > 0) {
      throw new MessageError(this.reporter.lang('frozenLockfileError'));
    }

    const haveLockfile = await fs.exists(path.join(this.config.cwd, constants.LOCKFILE_FILENAME));

    if (match.integrityMatches && haveLockfile) {
      this.reporter.success(this.reporter.lang('upToDate'));
      return true;
    }

    if (!patterns.length && !match.integrityFileMissing) {
      this.reporter.success(this.reporter.lang('nothingToInstall'));
      await this.createEmptyManifestFolders();
      await this.saveLockfileAndIntegrity(patterns);
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

  markIgnored(patterns: Array<string>) {
    for (const pattern of patterns) {
      const manifest = this.resolver.getStrictResolvedPattern(pattern);
      const ref = manifest._reference;
      invariant(ref, 'expected package reference');

      // just mark the package as ignored. if the package is used by a required package, the hoister
      // will take care of that.
      ref.ignore = true;
    }
  }

  /**
   * TODO description
   */

  async init(): Promise<Array<string>> {
    this.checkUpdate();

    // warn if we have a shrinkwrap
    if (await fs.exists(path.join(this.config.cwd, 'npm-shrinkwrap.json'))) {
      this.reporter.warn(this.reporter.lang('shrinkwrapWarning'));
    }

    let flattenedTopLevelPatterns: Array<string> = [];
    const steps: Array<(curr: number, total: number) => Promise<{bailout: boolean} | void>> = [];
    const {
      requests: depRequests,
      patterns: rawPatterns,
      ignorePatterns,
      workspaceLayout,
      manifest,
    } = await this.fetchRequestFromCwd();
    let topLevelPatterns: Array<string> = [];

    const artifacts = await this.integrityChecker.getArtifacts();
    if (artifacts) {
      this.linker.setArtifacts(artifacts);
      this.scripts.setArtifacts(artifacts);
    }

    if (!this.flags.ignoreEngines && typeof manifest.engines === 'object') {
      steps.push(async (curr: number, total: number) => {
        this.reporter.step(curr, total, this.reporter.lang('checkingManifest'), emoji.get('mag'));
        await compatibility.checkOne({_reference: {}, ...manifest}, this.config, this.flags.ignoreEngines);
      });
    }

    steps.push(async (curr: number, total: number) => {
      this.reporter.step(curr, total, this.reporter.lang('resolvingPackages'), emoji.get('mag'));
      await this.resolver.init(this.prepareRequests(depRequests), {
        isFlat: this.flags.flat,
        isFrozen: this.flags.frozenLockfile,
        workspaceLayout,
      });
      topLevelPatterns = this.preparePatterns(rawPatterns);
      flattenedTopLevelPatterns = await this.flatten(topLevelPatterns);
      return {bailout: await this.bailout(topLevelPatterns, workspaceLayout)};
    });

    steps.push(async (curr: number, total: number) => {
      this.markIgnored(ignorePatterns);
      this.reporter.step(curr, total, this.reporter.lang('fetchingPackages'), emoji.get('truck'));
      const manifests: Array<Manifest> = await fetcher.fetch(this.resolver.getManifests(), this.config);
      this.resolver.updateManifests(manifests);
      await compatibility.check(this.resolver.getManifests(), this.config, this.flags.ignoreEngines);
    });

    steps.push(async (curr: number, total: number) => {
      // remove integrity hash to make this operation atomic
      await this.integrityChecker.removeIntegrityFile();
      this.reporter.step(curr, total, this.reporter.lang('linkingDependencies'), emoji.get('link'));
      await this.linker.init(flattenedTopLevelPatterns, this.flags.linkDuplicates, workspaceLayout);
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
        await this.scripts.init(flattenedTopLevelPatterns);
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
        this.maybeOutputUpdate();
        return flattenedTopLevelPatterns;
      }
    }

    // fin!
    await this.saveLockfileAndIntegrity(topLevelPatterns, workspaceLayout);
    this.maybeOutputUpdate();
    this.config.requestManager.clearCache();
    return flattenedTopLevelPatterns;
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
   * Remove offline tarballs that are no longer required
   */

  async pruneOfflineMirror(lockfile: Object): Promise<void> {
    const mirror = this.config.getOfflineMirrorPath();
    if (!mirror) {
      return;
    }

    const requiredTarballs = new Set();
    for (const dependency in lockfile) {
      const resolved = lockfile[dependency].resolved;
      const basename = path.basename(resolved.split('#')[0]);
      if (resolved) {
        if (dependency[0] === '@' && basename[0] !== '@') {
          requiredTarballs.add(`${dependency.split('/')[0]}-${basename}`);
        }
        requiredTarballs.add(basename);
      }
    }

    const mirrorFiles = await fs.walk(mirror);
    for (const file of mirrorFiles) {
      const isTarball = path.extname(file.basename) === '.tgz';
      if (isTarball && !requiredTarballs.has(file.basename)) {
        await fs.unlink(file.absolute);
      }
    }
  }

  /**
   * Save updated integrity and lockfiles.
   */

  async saveLockfileAndIntegrity(patterns: Array<string>, workspaceLayout: ?WorkspaceLayout): Promise<void> {
    const resolvedPatterns: {[packagePattern: string]: Manifest} = {};
    Object.keys(this.resolver.patterns).forEach(pattern => {
      if (!workspaceLayout || !workspaceLayout.getManifestByPattern(pattern)) {
        resolvedPatterns[pattern] = this.resolver.patterns[pattern];
      }
    });

    // TODO this code is duplicated in a few places, need a common way to filter out workspace patterns from lockfile
    patterns = patterns.filter(p => !workspaceLayout || !workspaceLayout.getManifestByPattern(p));

    const lockfileBasedOnResolver = this.lockfile.getLockfile(resolvedPatterns);

    if (this.config.pruneOfflineMirror) {
      await this.pruneOfflineMirror(lockfileBasedOnResolver);
    }

    // write integrity hash
    await this.integrityChecker.save(
      patterns,
      lockfileBasedOnResolver,
      this.flags,
      this.resolver.usedRegistries,
      this.scripts.getArtifacts(),
    );

    // --no-lockfile or --pure-lockfile flag
    if (this.flags.lockfile === false || this.flags.pureLockfile) {
      return;
    }

    const lockFileHasAllPatterns = patterns.every(p => this.lockfile.getLocked(p));
    const resolverPatternsAreSameAsInLockfile = Object.keys(lockfileBasedOnResolver).every(pattern => {
      const manifest = this.lockfile.getLocked(pattern);
      return manifest && manifest.resolved === lockfileBasedOnResolver[pattern].resolved;
    });
    // remove command is followed by install with force, lockfile will be rewritten in any case then
    if (lockFileHasAllPatterns && resolverPatternsAreSameAsInLockfile && patterns.length && !this.flags.force) {
      return;
    }

    // build lockfile location
    const loc = path.join(this.config.lockfileFolder, constants.LOCKFILE_FILENAME);

    // write lockfile
    const lockSource = lockStringify(lockfileBasedOnResolver, false, this.config.enableLockfileVersions);
    await fs.writeFilePreservingEol(loc, lockSource);

    this._logSuccessSaveLockfile();
  }

  _logSuccessSaveLockfile() {
    this.reporter.success(this.reporter.lang('savedLockfile'));
  }

  /**
   * Load the dependency graph of the current install. Only does package resolving and wont write to the cwd.
   */
  async hydrate(ignoreUnusedPatterns?: boolean): Promise<InstallCwdRequest> {
    const request = await this.fetchRequestFromCwd([], ignoreUnusedPatterns);
    const {requests: depRequests, patterns: rawPatterns, ignorePatterns, workspaceLayout} = request;

    await this.resolver.init(depRequests, {
      isFlat: this.flags.flat,
      isFrozen: this.flags.frozenLockfile,
      workspaceLayout,
    });
    await this.flatten(rawPatterns);
    this.markIgnored(ignorePatterns);

    // fetch packages, should hit cache most of the time
    const manifests: Array<Manifest> = await fetcher.fetch(this.resolver.getManifests(), this.config);
    this.resolver.updateManifests(manifests);
    await compatibility.check(this.resolver.getManifests(), this.config, this.flags.ignoreEngines);

    // expand minimal manifests
    for (const manifest of this.resolver.getManifests()) {
      const ref = manifest._reference;
      invariant(ref, 'expected reference');
      const {type} = ref.remote;
      // link specifier won't ever hit cache
      let loc = '';
      if (type === 'link') {
        continue;
      } else if (type === 'workspace') {
        if (!ref.remote.reference) {
          continue;
        }
        loc = ref.remote.reference;
      } else {
        loc = this.config.generateHardModulePath(ref);
      }
      const newPkg = await this.config.readManifest(loc);
      await this.resolver.updateManifest(ref, newPkg);
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

    // don't check if disabled
    if (this.config.getOption('disable-self-update-check')) {
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
      url: constants.SELF_UPDATE_VERSION_URL,
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
      const installationMethod = await getInstallationMethod();
      this.maybeOutputUpdate = () => {
        this.reporter.warn(this.reporter.lang('yarnOutdated', latestVersion, YARN_VERSION));

        const command = getUpdateCommand(installationMethod);
        if (command) {
          this.reporter.info(this.reporter.lang('yarnOutdatedCommand'));
          this.reporter.command(command);
        } else {
          const installer = getUpdateInstaller(installationMethod);
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

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
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

export async function install(config: Config, reporter: Reporter, flags: Object, lockfile: Lockfile): Promise<void> {
  await wrapLifecycle(config, flags, async () => {
    const install = new Install(flags, config, reporter, lockfile);
    await install.init();
  });
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  let lockfile;
  if (flags.lockfile === false) {
    lockfile = new Lockfile();
  } else {
    lockfile = await Lockfile.fromDirectory(config.lockfileFolder, reporter);
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

  await install(config, reporter, flags, lockfile);
}

export async function wrapLifecycle(config: Config, flags: Object, factory: () => Promise<void>): Promise<void> {
  await config.executeLifecycleScript('preinstall');

  await factory();

  // npm behaviour, seems kinda funky but yay compatibility
  await config.executeLifecycleScript('install');
  await config.executeLifecycleScript('postinstall');

  if (!config.production) {
    if (!config.disablePrepublish) {
      await config.executeLifecycleScript('prepublish');
    }
    await config.executeLifecycleScript('prepare');
  }
}
