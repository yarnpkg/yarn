/* @flow */

import type {ReadStream} from 'fs';
import type Reporter from '../reporters/base-reporter.js';

import fs from 'fs';
import globModule from 'glob';
import os from 'os';
import path from 'path';

import BlockingQueue from './blocking-queue.js';
import * as promise from './promise.js';
import {promisify} from './promise.js';
import map from './map.js';

export const constants =
  typeof fs.constants !== 'undefined'
    ? fs.constants
    : {
        R_OK: fs.R_OK,
        W_OK: fs.W_OK,
        X_OK: fs.X_OK,
      };

export const lockQueue = new BlockingQueue('fs lock');

export const readFileBuffer = promisify(fs.readFile);
export const writeFile: (path: string, data: string, options?: Object) => Promise<void> = promisify(fs.writeFile);
export const readlink: (path: string, opts: void) => Promise<string> = promisify(fs.readlink);
export const realpath: (path: string, opts: void) => Promise<string> = promisify(fs.realpath);
export const readdir: (path: string, opts: void) => Promise<Array<string>> = promisify(fs.readdir);
export const rename: (oldPath: string, newPath: string) => Promise<void> = promisify(fs.rename);
export const access: (path: string, mode?: number) => Promise<void> = promisify(fs.access);
export const stat: (path: string) => Promise<fs.Stats> = promisify(fs.stat);
export const unlink: (path: string) => Promise<void> = promisify(require('rimraf'));
export const mkdirp: (path: string) => Promise<void> = promisify(require('mkdirp'));
export const exists: (path: string) => Promise<boolean> = promisify(fs.exists, true);
export const lstat: (path: string) => Promise<fs.Stats> = promisify(fs.lstat);
export const chmod: (path: string, mode: number | string) => Promise<void> = promisify(fs.chmod);
export const link: (src: string, dst: string) => Promise<fs.Stats> = promisify(fs.link);
export const glob: (path: string, options?: Object) => Promise<Array<string>> = promisify(globModule);

// fs.copyFile uses the native file copying instructions on the system, performing much better
// than any JS-based solution and consumes fewer resources. Repeated testing to fine tune the
// concurrency level revealed 128 as the sweet spot on a quad-core, 16 CPU Intel system with SSD.
const CONCURRENT_QUEUE_ITEMS = fs.copyFile ? 128 : 4;

const open: (path: string, flags: string | number, mode: number) => Promise<number> = promisify(fs.open);
const close: (fd: number) => Promise<void> = promisify(fs.close);
const write: (
  fd: number,
  buffer: Buffer,
  offset: ?number,
  length: ?number,
  position: ?number,
) => Promise<void> = promisify(fs.write);
const futimes: (fd: number, atime: number, mtime: number) => Promise<void> = promisify(fs.futimes);
const copyFile: (src: string, dest: string, flags: number, data: CopyFileAction) => Promise<void> = fs.copyFile
  ? // Don't use `promisify` to avoid passing  the last, argument `data`, to the native method
    (src, dest, flags, data) =>
      new Promise((resolve, reject) => fs.copyFile(src, dest, flags, err => (err ? reject(err) : resolve(err))))
  : async (src, dest, flags, data) => {
      // Use open -> write -> futimes -> close sequence to avoid opening the file twice:
      // one with writeFile and one with utimes
      const fd = await open(dest, 'w', data.mode);
      try {
        const buffer = await readFileBuffer(src);
        await write(fd, buffer, 0, buffer.length);
        await futimes(fd, data.atime, data.mtime);
      } finally {
        await close(fd);
      }
    };
const fsSymlink: (target: string, path: string, type?: 'dir' | 'file' | 'junction') => Promise<void> = promisify(
  fs.symlink,
);
const invariant = require('invariant');
const stripBOM = require('strip-bom');

const noop = () => {};

export type CopyQueueItem = {
  src: string,
  dest: string,
  type?: string,
  onFresh?: ?() => void,
  onDone?: ?() => void,
};

type CopyQueue = Array<CopyQueueItem>;

type CopyFileAction = {
  src: string,
  dest: string,
  atime: number,
  mtime: number,
  mode: number,
};

type LinkFileAction = {
  src: string,
  dest: string,
  removeDest: boolean,
};

type CopySymlinkAction = {
  dest: string,
  linkname: string,
};

type CopyActions = {
  file: Array<CopyFileAction>,
  symlink: Array<CopySymlinkAction>,
  link: Array<LinkFileAction>,
};

type CopyOptions = {
  onProgress: (dest: string) => void,
  onStart: (num: number) => void,
  possibleExtraneous: Set<string>,
  ignoreBasenames: Array<string>,
  artifactFiles: Array<string>,
};

type FailedFolderQuery = {
  error: Error,
  folder: string,
};

type FolderQueryResult = {
  skipped: Array<FailedFolderQuery>,
  folder: ?string,
};

export const fileDatesEqual = (a: Date, b: Date) => {
  const aTime = a.getTime();
  const bTime = b.getTime();

  if (process.platform !== 'win32') {
    return aTime === bTime;
  }

  // See https://github.com/nodejs/node/pull/12607
  // Submillisecond times from stat and utimes are truncated on Windows,
  // causing a file with mtime 8.0079998 and 8.0081144 to become 8.007 and 8.008
  // and making it impossible to update these files to their correct timestamps.
  if (Math.abs(aTime - bTime) <= 1) {
    return true;
  }

  const aTimeSec = Math.floor(aTime / 1000);
  const bTimeSec = Math.floor(bTime / 1000);

  // See https://github.com/nodejs/node/issues/2069
  // Some versions of Node on windows zero the milliseconds when utime is used
  // So if any of the time has a milliseconds part of zero we suspect that the
  // bug is present and compare only seconds.
  if (aTime - aTimeSec * 1000 === 0 || bTime - bTimeSec * 1000 === 0) {
    return aTimeSec === bTimeSec;
  }

  return aTime === bTime;
};

async function buildActionsForCopy(
  queue: CopyQueue,
  events: CopyOptions,
  possibleExtraneous: Set<string>,
  reporter: Reporter,
): Promise<CopyActions> {
  const artifactFiles: Set<string> = new Set(events.artifactFiles || []);
  const files: Set<string> = new Set();

  // initialise events
  for (const item of queue) {
    const onDone = item.onDone;
    item.onDone = () => {
      events.onProgress(item.dest);
      if (onDone) {
        onDone();
      }
    };
  }
  events.onStart(queue.length);

  // start building actions
  const actions: CopyActions = {
    file: [],
    symlink: [],
    link: [],
  };

  // custom concurrency logic as we're always executing stacks of CONCURRENT_QUEUE_ITEMS queue items
  // at a time due to the requirement to push items onto the queue
  while (queue.length) {
    const items = queue.splice(0, CONCURRENT_QUEUE_ITEMS);
    await Promise.all(items.map(build));
  }

  // simulate the existence of some files to prevent considering them extraneous
  for (const file of artifactFiles) {
    if (possibleExtraneous.has(file)) {
      reporter.verbose(reporter.lang('verboseFilePhantomExtraneous', file));
      possibleExtraneous.delete(file);
    }
  }

  for (const loc of possibleExtraneous) {
    if (files.has(loc.toLowerCase())) {
      possibleExtraneous.delete(loc);
    }
  }

  return actions;

  //
  async function build(data: CopyQueueItem): Promise<void> {
    const {src, dest, type} = data;
    const onFresh = data.onFresh || noop;
    const onDone = data.onDone || noop;

    // TODO https://github.com/yarnpkg/yarn/issues/3751
    // related to bundled dependencies handling
    if (files.has(dest.toLowerCase())) {
      reporter.verbose(`The case-insensitive file ${dest} shouldn't be copied twice in one bulk copy`);
    } else {
      files.add(dest.toLowerCase());
    }

    if (type === 'symlink') {
      await mkdirp(path.dirname(dest));
      onFresh();
      actions.symlink.push({
        dest,
        linkname: src,
      });
      onDone();
      return;
    }

    if (events.ignoreBasenames.indexOf(path.basename(src)) >= 0) {
      // ignored file
      return;
    }

    const srcStat = await lstat(src);
    let srcFiles;

    if (srcStat.isDirectory()) {
      srcFiles = await readdir(src);
    }

    let destStat;
    try {
      // try accessing the destination
      destStat = await lstat(dest);
    } catch (e) {
      // proceed if destination doesn't exist, otherwise error
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }

    // if destination exists
    if (destStat) {
      const bothSymlinks = srcStat.isSymbolicLink() && destStat.isSymbolicLink();
      const bothFolders = srcStat.isDirectory() && destStat.isDirectory();
      const bothFiles = srcStat.isFile() && destStat.isFile();

      // EINVAL access errors sometimes happen which shouldn't because node shouldn't be giving
      // us modes that aren't valid. investigate this, it's generally safe to proceed.

      /* if (srcStat.mode !== destStat.mode) {
        try {
          await access(dest, srcStat.mode);
        } catch (err) {}
      } */

      if (bothFiles && srcStat.size === destStat.size && fileDatesEqual(srcStat.mtime, destStat.mtime)) {
        // we can safely assume this is the same file
        onDone();
        reporter.verbose(reporter.lang('verboseFileSkip', src, dest, srcStat.size, +srcStat.mtime));
        return;
      }

      if (bothSymlinks) {
        const srcReallink = await readlink(src);
        if (srcReallink === (await readlink(dest))) {
          // if both symlinks are the same then we can continue on
          onDone();
          reporter.verbose(reporter.lang('verboseFileSkipSymlink', src, dest, srcReallink));
          return;
        }
      }

      if (bothFolders) {
        // mark files that aren't in this folder as possibly extraneous
        const destFiles = await readdir(dest);
        invariant(srcFiles, 'src files not initialised');

        for (const file of destFiles) {
          if (srcFiles.indexOf(file) < 0) {
            const loc = path.join(dest, file);
            possibleExtraneous.add(loc);

            if ((await lstat(loc)).isDirectory()) {
              for (const file of await readdir(loc)) {
                possibleExtraneous.add(path.join(loc, file));
              }
            }
          }
        }
      }
    }

    if (destStat && destStat.isSymbolicLink()) {
      await unlink(dest);
      destStat = null;
    }

    if (srcStat.isSymbolicLink()) {
      onFresh();
      const linkname = await readlink(src);
      actions.symlink.push({
        dest,
        linkname,
      });
      onDone();
    } else if (srcStat.isDirectory()) {
      if (!destStat) {
        reporter.verbose(reporter.lang('verboseFileFolder', dest));
        await mkdirp(dest);
      }

      const destParts = dest.split(path.sep);
      while (destParts.length) {
        files.add(destParts.join(path.sep).toLowerCase());
        destParts.pop();
      }

      // push all files to queue
      invariant(srcFiles, 'src files not initialised');
      let remaining = srcFiles.length;
      if (!remaining) {
        onDone();
      }
      for (const file of srcFiles) {
        queue.push({
          dest: path.join(dest, file),
          onFresh,
          onDone: () => {
            if (--remaining === 0) {
              onDone();
            }
          },
          src: path.join(src, file),
        });
      }
    } else if (srcStat.isFile()) {
      onFresh();
      actions.file.push({
        src,
        dest,
        atime: srcStat.atime,
        mtime: srcStat.mtime,
        mode: srcStat.mode,
      });
      onDone();
    } else {
      throw new Error(`unsure how to copy this: ${src}`);
    }
  }
}

async function buildActionsForHardlink(
  queue: CopyQueue,
  events: CopyOptions,
  possibleExtraneous: Set<string>,
  reporter: Reporter,
): Promise<CopyActions> {
  const artifactFiles: Set<string> = new Set(events.artifactFiles || []);
  const files: Set<string> = new Set();

  // initialise events
  for (const item of queue) {
    const onDone = item.onDone || noop;
    item.onDone = () => {
      events.onProgress(item.dest);
      onDone();
    };
  }
  events.onStart(queue.length);

  // start building actions
  const actions: CopyActions = {
    file: [],
    symlink: [],
    link: [],
  };

  // custom concurrency logic as we're always executing stacks of CONCURRENT_QUEUE_ITEMS queue items
  // at a time due to the requirement to push items onto the queue
  while (queue.length) {
    const items = queue.splice(0, CONCURRENT_QUEUE_ITEMS);
    await Promise.all(items.map(build));
  }

  // simulate the existence of some files to prevent considering them extraneous
  for (const file of artifactFiles) {
    if (possibleExtraneous.has(file)) {
      reporter.verbose(reporter.lang('verboseFilePhantomExtraneous', file));
      possibleExtraneous.delete(file);
    }
  }

  for (const loc of possibleExtraneous) {
    if (files.has(loc.toLowerCase())) {
      possibleExtraneous.delete(loc);
    }
  }

  return actions;

  //
  async function build(data: CopyQueueItem): Promise<void> {
    const {src, dest} = data;
    const onFresh = data.onFresh || noop;
    const onDone = data.onDone || noop;
    if (files.has(dest.toLowerCase())) {
      // Fixes issue https://github.com/yarnpkg/yarn/issues/2734
      // When bulk hardlinking we have A -> B structure that we want to hardlink to A1 -> B1,
      // package-linker passes that modules A1 and B1 need to be hardlinked,
      // the recursive linking algorithm of A1 ends up scheduling files in B1 to be linked twice which will case
      // an exception.
      onDone();
      return;
    }
    files.add(dest.toLowerCase());

    if (events.ignoreBasenames.indexOf(path.basename(src)) >= 0) {
      // ignored file
      return;
    }

    const srcStat = await lstat(src);
    let srcFiles;

    if (srcStat.isDirectory()) {
      srcFiles = await readdir(src);
    }

    const destExists = await exists(dest);
    if (destExists) {
      const destStat = await lstat(dest);

      const bothSymlinks = srcStat.isSymbolicLink() && destStat.isSymbolicLink();
      const bothFolders = srcStat.isDirectory() && destStat.isDirectory();
      const bothFiles = srcStat.isFile() && destStat.isFile();

      if (srcStat.mode !== destStat.mode) {
        try {
          await access(dest, srcStat.mode);
        } catch (err) {
          // EINVAL access errors sometimes happen which shouldn't because node shouldn't be giving
          // us modes that aren't valid. investigate this, it's generally safe to proceed.
          reporter.verbose(err);
        }
      }

      // correct hardlink
      if (bothFiles && srcStat.ino !== null && srcStat.ino === destStat.ino) {
        onDone();
        reporter.verbose(reporter.lang('verboseFileSkip', src, dest, srcStat.ino));
        return;
      }

      if (bothSymlinks) {
        const srcReallink = await readlink(src);
        if (srcReallink === (await readlink(dest))) {
          // if both symlinks are the same then we can continue on
          onDone();
          reporter.verbose(reporter.lang('verboseFileSkipSymlink', src, dest, srcReallink));
          return;
        }
      }

      if (bothFolders) {
        // mark files that aren't in this folder as possibly extraneous
        const destFiles = await readdir(dest);
        invariant(srcFiles, 'src files not initialised');

        for (const file of destFiles) {
          if (srcFiles.indexOf(file) < 0) {
            const loc = path.join(dest, file);
            possibleExtraneous.add(loc);

            if ((await lstat(loc)).isDirectory()) {
              for (const file of await readdir(loc)) {
                possibleExtraneous.add(path.join(loc, file));
              }
            }
          }
        }
      }
    }

    if (srcStat.isSymbolicLink()) {
      onFresh();
      const linkname = await readlink(src);
      actions.symlink.push({
        dest,
        linkname,
      });
      onDone();
    } else if (srcStat.isDirectory()) {
      reporter.verbose(reporter.lang('verboseFileFolder', dest));
      await mkdirp(dest);

      const destParts = dest.split(path.sep);
      while (destParts.length) {
        files.add(destParts.join(path.sep).toLowerCase());
        destParts.pop();
      }

      // push all files to queue
      invariant(srcFiles, 'src files not initialised');
      let remaining = srcFiles.length;
      if (!remaining) {
        onDone();
      }
      for (const file of srcFiles) {
        queue.push({
          onFresh,
          src: path.join(src, file),
          dest: path.join(dest, file),
          onDone: () => {
            if (--remaining === 0) {
              onDone();
            }
          },
        });
      }
    } else if (srcStat.isFile()) {
      onFresh();
      actions.link.push({
        src,
        dest,
        removeDest: destExists,
      });
      onDone();
    } else {
      throw new Error(`unsure how to copy this: ${src}`);
    }
  }
}

export function copy(src: string, dest: string, reporter: Reporter): Promise<void> {
  return copyBulk([{src, dest}], reporter);
}

/**
 * Unlinks the destination to force a recreation. This is needed on case-insensitive file systems
 * to force the correct naming when the filename has changed only in character-casing. (Jest -> jest).
 * It also calls a cleanup function once it is done.
 *
 * `data` contains target file attributes like mode, atime and mtime. Built-in copyFile copies these
 * automatically but our polyfill needs the do this manually, thus needs the info.
 */
const safeCopyFile = async function(data: CopyFileAction, cleanup: () => mixed): Promise<void> {
  try {
    await unlink(data.dest);
    await copyFile(data.src, data.dest, 0, data);
  } finally {
    cleanup();
  }
};

export async function copyBulk(
  queue: CopyQueue,
  reporter: Reporter,
  _events?: {
    onProgress?: ?(dest: string) => void,
    onStart?: ?(num: number) => void,
    possibleExtraneous: Set<string>,
    ignoreBasenames?: Array<string>,
    artifactFiles?: Array<string>,
  },
): Promise<void> {
  const events: CopyOptions = {
    onStart: (_events && _events.onStart) || noop,
    onProgress: (_events && _events.onProgress) || noop,
    possibleExtraneous: _events ? _events.possibleExtraneous : new Set(),
    ignoreBasenames: (_events && _events.ignoreBasenames) || [],
    artifactFiles: (_events && _events.artifactFiles) || [],
  };

  const actions: CopyActions = await buildActionsForCopy(queue, events, events.possibleExtraneous, reporter);
  events.onStart(actions.file.length + actions.symlink.length + actions.link.length);

  const fileActions: Array<CopyFileAction> = actions.file;

  const currentlyWriting: Map<string, Promise<void>> = new Map();

  await promise.queue(
    fileActions,
    async (data: CopyFileAction): Promise<void> => {
      let writePromise;
      while ((writePromise = currentlyWriting.get(data.dest))) {
        await writePromise;
      }

      reporter.verbose(reporter.lang('verboseFileCopy', data.src, data.dest));
      const copier = safeCopyFile(data, () => currentlyWriting.delete(data.dest));
      currentlyWriting.set(data.dest, copier);
      events.onProgress(data.dest);
      return copier;
    },
    CONCURRENT_QUEUE_ITEMS,
  );

  // we need to copy symlinks last as they could reference files we were copying
  const symlinkActions: Array<CopySymlinkAction> = actions.symlink;
  await promise.queue(symlinkActions, (data): Promise<void> => {
    const linkname = path.resolve(path.dirname(data.dest), data.linkname);
    reporter.verbose(reporter.lang('verboseFileSymlink', data.dest, linkname));
    return symlink(linkname, data.dest);
  });
}

export async function hardlinkBulk(
  queue: CopyQueue,
  reporter: Reporter,
  _events?: {
    onProgress?: ?(dest: string) => void,
    onStart?: ?(num: number) => void,
    possibleExtraneous: Set<string>,
    artifactFiles?: Array<string>,
  },
): Promise<void> {
  const events: CopyOptions = {
    onStart: (_events && _events.onStart) || noop,
    onProgress: (_events && _events.onProgress) || noop,
    possibleExtraneous: _events ? _events.possibleExtraneous : new Set(),
    artifactFiles: (_events && _events.artifactFiles) || [],
    ignoreBasenames: [],
  };

  const actions: CopyActions = await buildActionsForHardlink(queue, events, events.possibleExtraneous, reporter);
  events.onStart(actions.file.length + actions.symlink.length + actions.link.length);

  const fileActions: Array<LinkFileAction> = actions.link;

  await promise.queue(
    fileActions,
    async (data): Promise<void> => {
      reporter.verbose(reporter.lang('verboseFileLink', data.src, data.dest));
      if (data.removeDest) {
        await unlink(data.dest);
      }
      await link(data.src, data.dest);
    },
    CONCURRENT_QUEUE_ITEMS,
  );

  // we need to copy symlinks last as they could reference files we were copying
  const symlinkActions: Array<CopySymlinkAction> = actions.symlink;
  await promise.queue(symlinkActions, (data): Promise<void> => {
    const linkname = path.resolve(path.dirname(data.dest), data.linkname);
    reporter.verbose(reporter.lang('verboseFileSymlink', data.dest, linkname));
    return symlink(linkname, data.dest);
  });
}

function _readFile(loc: string, encoding: string): Promise<any> {
  return new Promise((resolve, reject) => {
    fs.readFile(loc, encoding, function(err, content) {
      if (err) {
        reject(err);
      } else {
        resolve(content);
      }
    });
  });
}

export function readFile(loc: string): Promise<string> {
  return _readFile(loc, 'utf8').then(normalizeOS);
}

export function readFileRaw(loc: string): Promise<Buffer> {
  return _readFile(loc, 'binary');
}

export async function readFileAny(files: Array<string>): Promise<?string> {
  for (const file of files) {
    if (await exists(file)) {
      return readFile(file);
    }
  }
  return null;
}

export async function readJson(loc: string): Promise<Object> {
  return (await readJsonAndFile(loc)).object;
}

export async function readJsonAndFile(
  loc: string,
): Promise<{
  object: Object,
  content: string,
}> {
  const file = await readFile(loc);
  try {
    return {
      object: map(JSON.parse(stripBOM(file))),
      content: file,
    };
  } catch (err) {
    err.message = `${loc}: ${err.message}`;
    throw err;
  }
}

export async function find(filename: string, dir: string): Promise<string | false> {
  const parts = dir.split(path.sep);

  while (parts.length) {
    const loc = parts.concat(filename).join(path.sep);

    if (await exists(loc)) {
      return loc;
    } else {
      parts.pop();
    }
  }

  return false;
}

export async function symlink(src: string, dest: string): Promise<void> {
  try {
    const stats = await lstat(dest);

    if (stats.isSymbolicLink() && (await exists(dest))) {
      const resolved = await realpath(dest);
      if (resolved === src) {
        return;
      }
    }

    await unlink(dest);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }

  try {
    if (process.platform === 'win32') {
      // use directory junctions if possible on win32, this requires absolute paths
      await fsSymlink(src, dest, 'junction');
    } else {
      // use relative paths otherwise which will be retained if the directory is moved
      let relative;
      if (await exists(src)) {
        relative = path.relative(fs.realpathSync(path.dirname(dest)), fs.realpathSync(src));
      } else {
        relative = path.relative(path.dirname(dest), src);
      }
      // When path.relative returns an empty string for the current directory, we should instead use
      // '.', which is a valid fs.symlink target.
      await fsSymlink(relative || '.', dest);
    }
  } catch (err) {
    if (err.code === 'EEXIST') {
      // race condition
      await symlink(src, dest);
    } else {
      throw err;
    }
  }
}

export type WalkFiles = Array<{
  relative: string,
  absolute: string,
  basename: string,
  mtime: number,
}>;

export async function walk(
  dir: string,
  relativeDir?: ?string,
  ignoreBasenames?: Set<string> = new Set(),
): Promise<WalkFiles> {
  let files = [];

  let filenames = await readdir(dir);
  if (ignoreBasenames.size) {
    filenames = filenames.filter(name => !ignoreBasenames.has(name));
  }

  for (const name of filenames) {
    const relative = relativeDir ? path.join(relativeDir, name) : name;
    const loc = path.join(dir, name);
    const stat = await lstat(loc);

    files.push({
      relative,
      basename: name,
      absolute: loc,
      mtime: +stat.mtime,
    });

    if (stat.isDirectory()) {
      files = files.concat(await walk(loc, relative, ignoreBasenames));
    }
  }

  return files;
}

export async function getFileSizeOnDisk(loc: string): Promise<number> {
  const stat = await lstat(loc);
  const {size, blksize: blockSize} = stat;

  return Math.ceil(size / blockSize) * blockSize;
}

export function normalizeOS(body: string): string {
  return body.replace(/\r\n/g, '\n');
}

const cr = new Buffer('\r', 'utf8')[0];
const lf = new Buffer('\n', 'utf8')[0];

async function getEolFromFile(path: string): Promise<string | void> {
  if (!await exists(path)) {
    return undefined;
  }

  const buffer = await readFileBuffer(path);

  for (let i = 0; i < buffer.length; ++i) {
    if (buffer[i] === cr) {
      return '\r\n';
    }
    if (buffer[i] === lf) {
      return '\n';
    }
  }
  return undefined;
}

export async function writeFilePreservingEol(path: string, data: string): Promise<void> {
  const eol = (await getEolFromFile(path)) || os.EOL;
  if (eol !== '\n') {
    data = data.replace(/\n/g, eol);
  }
  await writeFile(path, data);
}

export async function hardlinksWork(dir: string): Promise<boolean> {
  const filename = 'test-file' + Math.random();
  const file = path.join(dir, filename);
  const fileLink = path.join(dir, filename + '-link');
  try {
    await writeFile(file, 'test');
    await link(file, fileLink);
  } catch (err) {
    return false;
  } finally {
    await unlink(file);
    await unlink(fileLink);
  }
  return true;
}

// not a strict polyfill for Node's fs.mkdtemp
export async function makeTempDir(prefix?: string): Promise<string> {
  const dir = path.join(os.tmpdir(), `yarn-${prefix || ''}-${Date.now()}-${Math.random()}`);
  await unlink(dir);
  await mkdirp(dir);
  return dir;
}

export async function readFirstAvailableStream(
  paths: Iterable<?string>,
): Promise<{stream: ?ReadStream, triedPaths: Array<string>}> {
  let stream: ?ReadStream;
  const triedPaths = [];
  for (const tarballPath of paths) {
    if (tarballPath) {
      try {
        // We need the weird `await new Promise()` construct for `createReadStream` because
        // it always returns a ReadStream object but immediately triggers an `error` event
        // on it if it fails to open the file, instead of throwing an exception. If this event
        // is not handled, it crashes node. A saner way to handle this with multiple tries is
        // the following construct.
        stream = await new Promise((resolve, reject) => {
          const maybeStream = fs.createReadStream(tarballPath);
          maybeStream.on('error', reject).on('readable', resolve.bind(this, maybeStream));
        });
        break;
      } catch (err) {
        // Try the next one
        triedPaths.push(tarballPath);
      }
    }
  }

  return {stream, triedPaths};
}

export async function getFirstSuitableFolder(
  paths: Iterable<string>,
  mode: number = constants.W_OK | constants.X_OK, // eslint-disable-line no-bitwise
): Promise<FolderQueryResult> {
  const result: FolderQueryResult = {
    skipped: [],
    folder: null,
  };

  for (const folder of paths) {
    try {
      await mkdirp(folder);
      await access(folder, mode);

      result.folder = folder;

      return result;
    } catch (error) {
      result.skipped.push({
        error,
        folder,
      });
    }
  }
  return result;
}
