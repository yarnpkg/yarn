/* @flow */

import type {RegistryNames} from '../../registries/index.js';
import type {Reporter} from '../../reporters/index.js';
import type {Manifest} from '../../types.js';
import type Config from '../../config.js';
import type PackageResolver from '../../package-resolver.js';
import {MessageError} from '../../errors.js';
import {registryNames} from '../../registries/index.js';
import NoopReporter from '../../reporters/base-reporter.js';
import buildSubCommands from './_build-sub-commands.js';
import Lockfile from '../../lockfile/wrapper.js';
import {Install} from './install.js';
import {Add} from './add.js';
import {run as runRemove} from './remove.js';
import {run as runUpgrade} from './upgrade.js';
import {linkBin} from '../../package-linker.js';
import {entries} from '../../util/misc.js';
import * as fs from '../../util/fs.js';

type BinData = {
  pkgName: string,
  scriptName: string,
};

class GlobalAdd extends Add {
  maybeOutputSaveTree(): Promise<void> {
    for (const pattern of this.addedPatterns) {
      const manifest = this.resolver.getStrictResolvedPattern(pattern);
      ls(manifest, this.reporter, true);
    }
    return Promise.resolve();
  }

  _logSuccessSaveLockfile() {
    // noop
  }
}

const path = require('path');

async function updateCwd(config: Config): Promise<void> {
  await config.init({
    cwd: config.globalFolder,
    binLinks: config.binLinks,
    globalFolder: config.globalFolder,
    cacheFolder: config.cacheFolder,
    linkFolder: config.linkFolder,
  });
}

async function getBins(config: Config, resolver?: PackageResolver): Promise<Map<string, BinData>> {
  // build up list of existing binary files
  const paths: Map<string, BinData> = new Map();

  async function selfBinScripts(bin: Array<[string, string]>, loc: string,
                                pkgLoc: string, pkgName: string): Promise<void> {
    for (const [scriptName, scriptCmd] of bin) {
      // Include bins that have a link in the global bin folder,
      // bins are not linked when config.binLinks is false
      const src = path.join(pkgLoc, scriptCmd);
      const binPath = path.join(loc, '.bin', scriptName);
      if (await fs.exists(binPath) && await fs.exists(src)) {
        paths.set(src, {scriptName, pkgName});
      }
    }
  }

  async function resolveDependencies(dependencies: Array<[string, string]>, loc: string,
                                     registryName: RegistryNames): Promise<void> {
    for (const [name, version] of dependencies) {
      const pkgLoc = path.join(loc, name);
      const resolved =  resolver ?
        resolver.getResolvedPattern(`${name}@${version}`) :
        await config.readManifest(pkgLoc, registryName);
      const bin = resolved && resolved.bin || {};
      await selfBinScripts(entries(bin), loc, pkgLoc, name);
    }
  }

  // build up list of registry folders to search for binaries
  const rootManifests = await config.getRootManifests();
  for (const registryName of registryNames) {
    const registry = config.registries[registryName];
    const manifest = rootManifests[registryName];
    // in global manifets we check only for 'dependencies'
    const dependencies = manifest.exists ? manifest.object.dependencies : {};
    await resolveDependencies(entries(dependencies), registry.loc, registryName);
  }

  return paths;
}

function getGlobalPrefix(config: Config, flags: Object): string {
  if (flags.prefix) {
    return flags.prefix;
  } else if (config.getOption('prefix')) {
    return String(config.getOption('prefix'));
  } else if (process.env.PREFIX) {
    return process.env.PREFIX;
  } else if (process.platform === 'win32') {
    // c:\node\node.exe --> prefix=c:\node\
    return path.dirname(process.execPath);
  } else {
    // /usr/local/bin/node --> prefix=/usr/local
    let prefix = path.dirname(path.dirname(process.execPath));

    // destdir only is respected on Unix
    if (process.env.DESTDIR) {
      prefix = path.join(process.env.DESTDIR, prefix);
    }

    return prefix;
  }
}

function getBinFolder(config: Config, flags: Object): string {
  const prefix = getGlobalPrefix(config, flags);
  if (process.platform === 'win32') {
    return prefix;
  } else {
    return path.resolve(prefix, 'bin');
  }
}

async function unlink(dest: string): Promise<void> {
  await fs.unlink(dest);
  if (process.platform === 'win32' && dest.indexOf('.cmd') === -1) {
    await fs.unlink(dest + '.cmd');
  }
}

async function initUpdateBins(config: Config, reporter: Reporter, flags: Object): Promise<() => Promise<void>> {
  const beforeBins = await getBins(config);
  const binFolder = getBinFolder(config, flags);

  function throwPermError(err: Error & { [code: string]: string }, dest: string) {
    if (err.code === 'EACCES') {
      throw new MessageError(reporter.lang('noFilePermission', dest));
    } else {
      throw err;
    }
  }

  return async function(resolver?: PackageResolver, args?: Array<string> = []): Promise<void> {
    const afterBins = await getBins(config, resolver);

    // remove old bins
    for (const [src, {scriptName}] of beforeBins) {
      if (afterBins.has(src)) {
        // not old
        continue;
      }

      // remove old bin
      const dest = path.join(binFolder, scriptName);
      try {
        await unlink(dest);
      } catch (err) {
        throwPermError(err, dest);
      }
    }

    const patterns = args.map((pattern) => pattern.split('@')[0]);
    const pkgChanged = (pkgName: string): boolean => patterns.indexOf(pkgName) > -1;
    // add new bins
    for (const [src, {scriptName, pkgName}] of afterBins) {
      if (beforeBins.has(src) && !pkgChanged(pkgName)) {
        // already inserted
        continue;
      }

      // insert new bin
      const dest = path.join(binFolder, scriptName);
      try {
        await unlink(dest);
        await linkBin(src, dest);
      } catch (err) {
        throwPermError(err, dest);
      }
    }
  };
}

function ls(manifest: Manifest, reporter: Reporter, saved: boolean) {
  const bins = manifest.bin ? Object.keys(manifest.bin) : [];
  const human = `${manifest.name}@${manifest.version}`;
  if (bins.length) {
    if (saved) {
      reporter.success(`Installed ${human} with binaries:`);
    } else {
      reporter.info(`${human} has binaries:`);
    }
    reporter.list(`bins-${manifest.name}`, bins);
  } else if (saved) {
    reporter.warn(`${human} has no binaries`);
  }
}

export function hasWrapper(flags: Object, args: Array<string>): boolean {
  return args[0] !== 'bin';
}

const {run, setFlags: _setFlags} = buildSubCommands('global', {
  async add(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    await updateCwd(config);

    const updateBins = await initUpdateBins(config, reporter, flags);

    // install module
    const lockfile = await Lockfile.fromDirectory(config.cwd);
    const install = new GlobalAdd(args, flags, config, reporter, lockfile);
    await install.init();

    // link binaries
    await updateBins(install.resolver, args);
  },

  bin(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ) {
    console.log(getBinFolder(config, flags));
  },

  async ls(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    await updateCwd(config);

    // install so we get hard file paths
    const lockfile = await Lockfile.fromDirectory(config.cwd);
    const install = new Install({skipIntegrity: true}, config, new NoopReporter(), lockfile);
    const patterns = await install.init();

    // dump global modules
    for (const pattern of patterns) {
      const manifest = install.resolver.getStrictResolvedPattern(pattern);
      ls(manifest, reporter, false);
    }
  },

  async remove(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    await updateCwd(config);

    const updateBins = await initUpdateBins(config, reporter, flags);

    // remove module
    const remove = await runRemove(config, reporter, flags, args);

    // remove binaries
    await updateBins(remove.resolver);
  },

  async upgrade(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    await updateCwd(config);

    const updateBins = await initUpdateBins(config, reporter, flags);

    // upgrade module
    const upgrade = await runUpgrade(config, reporter, flags, args);

    // update binaries
    await updateBins(upgrade.resolver, args);
  },
});

export {run};

export function setFlags(commander: Object) {
  _setFlags(commander);
  commander.option('--prefix <prefix>', 'bin prefix to use to install binaries');
}
