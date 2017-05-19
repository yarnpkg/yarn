/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type {Manifest} from '../../types.js';
import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import {OSX_GLOBAL_PREFIX_DIRECTORY} from '../../constants.js';
import {registries} from '../../registries/index.js';
import NoopReporter from '../../reporters/base-reporter.js';
import buildSubCommands from './_build-sub-commands.js';
import Lockfile from '../../lockfile/wrapper.js';
import {Install} from './install.js';
import {Add} from './add.js';
import {run as runRemove} from './remove.js';
import {run as runUpgrade} from './upgrade.js';
import {run as runUpgradeInteractive} from './upgrade-interactive.js';
import {linkBin} from '../../package-linker.js';
import * as fs from '../../util/fs.js';

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

export function hasWrapper(flags: Object, args: Array<string>): boolean {
  return args[0] !== 'bin';
}

async function updateCwd(config: Config): Promise<void> {
  await config.init({
    cwd: config.globalFolder,
    binLinks: true,
    globalFolder: config.globalFolder,
    cacheFolder: config._cacheRootFolder,
    linkFolder: config.linkFolder,
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

function getGlobalPrefix(config: Config, flags: Object): string {
  if (flags.prefix) {
    return flags.prefix;
  } else if (config.getOption('prefix')) {
    return String(config.getOption('prefix'));
  } else if (process.env.PREFIX) {
    return process.env.PREFIX;
  } else if (process.platform === 'darwin') {
    return OSX_GLOBAL_PREFIX_DIRECTORY;
  } else if (process.platform === 'win32') {
    if (process.env.LOCALAPPDATA) {
      return path.join(process.env.LOCALAPPDATA, 'Yarn', 'bin');
    }
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

export function getBinFolder(config: Config, flags: Object): string {
  const prefix = getGlobalPrefix(config, flags);
  if (process.platform === 'win32') {
    return prefix;
  } else {
    return path.resolve(prefix, 'bin');
  }
}

async function initUpdateBins(config: Config, reporter: Reporter, flags: Object): Promise<() => Promise<void>> {
  const beforeBins = await getBins(config);
  const binFolder = getBinFolder(config, flags);

  function throwPermError(err: Error & {[code: string]: string}, dest: string) {
    if (err.code === 'EACCES') {
      throw new MessageError(reporter.lang('noFilePermission', dest));
    } else {
      throw err;
    }
  }

  return async function(): Promise<void> {
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
      if (beforeBins.has(src)) {
        // already inserted
        continue;
      }

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
  const install = new Install({skipIntegrityCheck: true}, config, new NoopReporter(), lockfile);
  const patterns = await install.init();

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

  bin(config: Config, reporter: Reporter, flags: Object, args: Array<string>) {
    reporter.log(getBinFolder(config, flags));
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
  commander.option('--prefix <prefix>', 'bin prefix to use to install binaries');
}
