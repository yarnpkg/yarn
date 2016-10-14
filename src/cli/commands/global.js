/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type {Manifest} from '../../types.js';
import type Config from '../../config.js';
import {registries} from '../../registries/index.js';
import NoopReporter from '../../reporters/base-reporter.js';
import buildSubCommands from './_build-sub-commands.js';
import Lockfile from '../../lockfile/wrapper.js';
import {Install} from './install.js';
import {Add} from './add.js';
import {run as runRemove} from './remove.js';
import {linkBin} from '../../package-linker.js';
import * as fs from '../../util/fs.js';

class GlobalAdd extends Add {
  maybeOutputSaveTree(): Promise<void> {
    for (const pattern of this.args) {
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
  await config.init({cwd: config.globalFolder});
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

function getGlobalPrefix(): string {
  if (process.env.PREFIX) {
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

function getBinFolder(): string {
  const prefix = getGlobalPrefix();
  if (process.platform === 'win32') {
    return prefix;
  } else {
    return path.resolve(prefix, 'bin');
  }
}

async function initUpdateBins(config: Config, reporter: Reporter): Promise<() => Promise<void>> {
  const beforeBins = await getBins(config);
  const binFolder = getBinFolder();

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
      await fs.unlink(dest);
    }

    // add new bins
    for (const src of afterBins) {
      if (beforeBins.has(src)) {
        // already inserted
        continue;
      }

      // insert new bin
      const dest = path.join(binFolder, path.basename(src));
      await fs.unlink(dest);
      await linkBin(src, dest);
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

export const {run, setFlags} = buildSubCommands('global', {
  async add(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    await updateCwd(config);

    const updateBins = await initUpdateBins(config, reporter);

    // install module
    const lockfile = await Lockfile.fromDirectory(config.cwd);
    const install = new GlobalAdd(args, flags, config, reporter, lockfile);
    await install.init();

    // link binaries
    await updateBins();
  },

  bin(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ) {
    console.log(getBinFolder());
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

    const updateBins = await initUpdateBins(config, reporter);

    // remove module
    await runRemove(config, reporter, flags, args);

    // remove binaries
    await updateBins();
  },
});
