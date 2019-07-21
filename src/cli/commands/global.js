/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type {Manifest} from '../../types.js';
import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import {registries} from '../../registries/index.js';
import NoopReporter from '../../reporters/base-reporter.js';
import buildSubCommands from './_build-sub-commands.js';
import Lockfile from '../../lockfile';
import {Install} from './install.js';
import {Add} from './add.js';
import {run as runRemove} from './remove.js';
import {run as runUpgrade} from './upgrade.js';
import {run as runUpgradeInteractive} from './upgrade-interactive.js';
import {linkBin} from '../../package-linker.js';
import {POSIX_GLOBAL_PREFIX, FALLBACK_GLOBAL_PREFIX} from '../../constants.js';
import * as fs from '../../util/fs.js';

class GlobalAdd extends Add {
  constructor(args: Array<string>, flags: Object, config: Config, reporter: Reporter, lockfile: Lockfile) {
    super(args, flags, config, reporter, lockfile);

    this.linker.setTopLevelBinLinking(false);
  }

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

export function hasWrapper(flags: Object, args: Array<string>): boolean {
  return args[0] !== 'bin' && args[0] !== 'dir';
}

async function updateCwd(config: Config): Promise<void> {
  await fs.mkdirp(config.globalFolder);

  await config.init({
    cwd: config.globalFolder,
    offline: config.offline,
    binLinks: true,
    globalFolder: config.globalFolder,
    cacheFolder: config._cacheRootFolder,
    linkFolder: config.linkFolder,
    enableDefaultRc: config.enableDefaultRc,
    extraneousYarnrcFiles: config.extraneousYarnrcFiles,
  });
}

async function getBins(config: Config): Promise<Set<string>> {
  // build up list of registry folders to search for binaries
  const dirs = [];
  for (const registryName of Object.keys(registries)) {
    const registry = config.registries[registryName];
    dirs.push(registry.loc);
  }

  // build up list of binary files
  const paths = new Set();
  for (const dir of dirs) {
    const binDir = path.join(dir, '.bin');
    if (!await fs.exists(binDir)) {
      continue;
    }

    for (const name of await fs.readdir(binDir)) {
      paths.add(path.join(binDir, name));
    }
  }
  return paths;
}

async function getGlobalPrefix(config: Config, flags: Object): Promise<string> {
  if (flags.prefix) {
    return flags.prefix;
  } else if (config.getOption('prefix', true)) {
    return String(config.getOption('prefix', true));
  } else if (process.env.PREFIX) {
    return process.env.PREFIX;
  }

  const potentialPrefixFolders = [FALLBACK_GLOBAL_PREFIX];
  if (process.platform === 'win32') {
    // %LOCALAPPDATA%\Yarn --> C:\Users\Alice\AppData\Local\Yarn
    if (process.env.LOCALAPPDATA) {
      potentialPrefixFolders.unshift(path.join(process.env.LOCALAPPDATA, 'Yarn'));
    }
  } else {
    potentialPrefixFolders.unshift(POSIX_GLOBAL_PREFIX);
  }

  const binFolders = potentialPrefixFolders.map(prefix => path.join(prefix, 'bin'));
  const prefixFolderQueryResult = await fs.getFirstSuitableFolder(binFolders);
  const prefix = prefixFolderQueryResult.folder && path.dirname(prefixFolderQueryResult.folder);

  if (!prefix) {
    config.reporter.warn(
      config.reporter.lang(
        'noGlobalFolder',
        prefixFolderQueryResult.skipped.map(item => path.dirname(item.folder)).join(', '),
      ),
    );

    return FALLBACK_GLOBAL_PREFIX;
  }

  return prefix;
}

export async function getBinFolder(config: Config, flags: Object): Promise<string> {
  const prefix = await getGlobalPrefix(config, flags);
  return path.resolve(prefix, 'bin');
}

async function initUpdateBins(config: Config, reporter: Reporter, flags: Object): Promise<() => Promise<void>> {
  const beforeBins = await getBins(config);
  const binFolder = await getBinFolder(config, flags);

  function throwPermError(err: Error & {[code: string]: string}, dest: string) {
    if (err.code === 'EACCES') {
      throw new MessageError(reporter.lang('noPermission', dest));
    } else {
      throw err;
    }
  }

  return async function(): Promise<void> {
    try {
      await fs.mkdirp(binFolder);
    } catch (err) {
      throwPermError(err, binFolder);
    }

    const afterBins = await getBins(config);

    // remove old bins
    for (const src of beforeBins) {
      if (afterBins.has(src)) {
        // not old
        continue;
      }

      // remove old bin
      const dest = path.join(binFolder, path.basename(src));
      try {
        await fs.unlink(dest);
      } catch (err) {
        throwPermError(err, dest);
      }
    }

    // add new bins
    for (const src of afterBins) {
      // insert new bin
      const dest = path.join(binFolder, path.basename(src));
      try {
        await fs.unlink(dest);
        await linkBin(src, dest);
        if (process.platform === 'win32' && dest.indexOf('.cmd') !== -1) {
          await fs.rename(dest + '.cmd', dest);
        }
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
      reporter.success(reporter.lang('packageInstalledWithBinaries', human));
    } else {
      reporter.info(reporter.lang('packageHasBinaries', human));
    }
    reporter.list(`bins-${manifest.name}`, bins);
  } else if (saved) {
    reporter.warn(reporter.lang('packageHasNoBinaries', human));
  }
}

async function list(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  await updateCwd(config);

  // install so we get hard file paths
  const lockfile = await Lockfile.fromDirectory(config.cwd);
  const install = new Install({}, config, new NoopReporter(), lockfile);
  const patterns = await install.getFlattenedDeps();

  // dump global modules
  for (const pattern of patterns) {
    const manifest = install.resolver.getStrictResolvedPattern(pattern);
    ls(manifest, reporter, false);
  }
}

const {run, setFlags: _setFlags} = buildSubCommands('global', {
  async add(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    await updateCwd(config);

    const updateBins = await initUpdateBins(config, reporter, flags);
    if (args.indexOf('yarn') !== -1) {
      reporter.warn(reporter.lang('packageContainsYarnAsGlobal'));
    }

    // install module
    const lockfile = await Lockfile.fromDirectory(config.cwd);
    const install = new GlobalAdd(args, flags, config, reporter, lockfile);
    await install.init();

    // link binaries
    await updateBins();
  },

  async bin(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    reporter.log(await getBinFolder(config, flags), {force: true});
  },

  dir(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    reporter.log(config.globalFolder, {force: true});
    return Promise.resolve();
  },

  async ls(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    reporter.warn(`\`yarn global ls\` is deprecated. Please use \`yarn global list\`.`);
    await list(config, reporter, flags, args);
  },

  async list(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    await list(config, reporter, flags, args);
  },

  async remove(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    await updateCwd(config);

    const updateBins = await initUpdateBins(config, reporter, flags);

    // remove module
    await runRemove(config, reporter, flags, args);

    // remove binaries
    await updateBins();
  },

  async upgrade(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    await updateCwd(config);

    const updateBins = await initUpdateBins(config, reporter, flags);

    // upgrade module
    await runUpgrade(config, reporter, flags, args);

    // update binaries
    await updateBins();
  },

  async upgradeInteractive(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    await updateCwd(config);

    const updateBins = await initUpdateBins(config, reporter, flags);

    // upgrade module
    await runUpgradeInteractive(config, reporter, flags, args);

    // update binaries
    await updateBins();
  },
});

export {run};

export function setFlags(commander: Object) {
  _setFlags(commander);
  commander.description('Installs packages globally on your operating system.');
  commander.option('--prefix <prefix>', 'bin prefix to use to install binaries');
  commander.option('--latest', 'upgrade to the latest version of packages');
}
