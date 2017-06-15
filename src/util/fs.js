/* @flow */

import type Reporter from '../reporters/base-reporter.js';
import BlockingQueue from './blocking-queue.js';
import * as promise from './promise.js';
import {promisify} from './promise.js';
import map from './map.js';

const fs = require('fs');
const globModule = require('glob');
const os = require('os');
const path = require('path');

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

const CONCURRENT_QUEUE_ITEMS = 4;

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
  type: 'file',
  src: string,
  dest: string,
  atime: number,
  mtime: number,
  mode: number,
};

type LinkFileAction = {
  type: 'link',
  src: string,
  dest: string,
  removeDest: boolean,
};

type CopySymlinkAction = {
  type: 'symlink',
  dest: string,
  linkname: string,
};

type CopyActions = Array<CopyFileAction | CopySymlinkAction | LinkFileAction>;

type CopyOptions = {
  onProgress: (dest: string) => void,
  onStart: (num: number) => void,
  possibleExtraneous: Set<string>,
  ignoreBasenames: Array<string>,
  artifactFiles: Array<string>,
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
  const actions: CopyActions = [];

  // custom concurrency logic as we're always executing stacks of CONCURRENT_QUEUE_ITEMS queue items
  // at a time due to the requirement to push items onto the queue
  while (queue.length) {
    const items = queue.splice(0, CONCURRENT_QUEUE_ITEMS);
    await Promise.all(items.map(build));
  }

  // simulate the existence of some files to prevent considering them extraenous
  for (const file of artifactFiles) {
    if (possibleExtraneous.has(file)) {
      reporter.verbose(reporter.lang('verboseFilePhantomExtraneous', file));
      possibleExtraneous.delete(file);
    }
  }

  for (const loc of possibleExtraneous) {
    if (files.has(loc)) {
      possibleExtraneous.delete(loc);
    }
  }

  return actions;

  //
  async function build(data): Promise<void> {
    const {src, dest, type} = data;
    const onFresh = data.onFresh || noop;
    const onDone = data.onDone || noop;
    files.add(dest);

    if (type === 'symlink') {
      await mkdirp(path.dirname(dest));
      onFresh();
      actions.push({
        type: 'symlink',
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

    if (srcStat.isSymbolicLink()) {
      onFresh();
      const linkname = await readlink(src);
      actions.push({
        dest,
        linkname,
        type: 'symlink',
      });
      onDone();
    } else if (srcStat.isDirectory()) {
      if (!destStat) {
        reporter.verbose(reporter.lang('verboseFileFolder', dest));
        await mkdirp(dest);
      }

      const destParts = dest.split(path.sep);
      while (destParts.length) {
        files.add(destParts.join(path.sep));
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
      actions.push({
        type: 'file',
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
  const actions: CopyActions = [];

  // custom concurrency logic as we're always executing stacks of CONCURRENT_QUEUE_ITEMS queue items
  // at a time due to the requirement to push items onto the queue
  while (queue.length) {
    const items = queue.splice(0, CONCURRENT_QUEUE_ITEMS);
    await Promise.all(items.map(build));
  }

  // simulate the existence of some files to prevent considering them extraenous
  for (const file of artifactFiles) {
    if (possibleExtraneous.has(file)) {
      reporter.verbose(reporter.lang('verboseFilePhantomExtraneous', file));
      possibleExtraneous.delete(file);
    }
  }

  for (const loc of possibleExtraneous) {
    if (files.has(loc)) {
      possibleExtraneous.delete(loc);
    }
  }

  return actions;

  //
  async function build(data): Promise<void> {
    const {src, dest} = data;
    const onFresh = data.onFresh || noop;
    const onDone = data.onDone || noop;
    files.add(dest);

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
      actions.push({
        type: 'symlink',
        dest,
        linkname,
      });
      onDone();
    } else if (srcStat.isDirectory()) {
      reporter.verbose(reporter.lang('verboseFileFolder', dest));
      await mkdirp(dest);

      const destParts = dest.split(path.sep);
      while (destParts.length) {
        files.add(destParts.join(path.sep));
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
      actions.push({
        type: 'link',
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
  events.onStart(actions.length);

  const fileActions: Array<CopyFileAction> = (actions.filter(action => action.type === 'file'): any);

  const currentlyWriting: {[dest: string]: Promise<void>} = {};

  await promise.queue(
    fileActions,
    async (data): Promise<void> => {
      let writePromise: Promise<void>;
      while ((writePromise = currentlyWriting[data.dest])) {
        await writePromise;
      }

      const cleanup = () => delete currentlyWriting[data.dest];
      reporter.verbose(reporter.lang('verboseFileCopy', data.src, data.dest));
      return (currentlyWriting[data.dest] = readFileBuffer(data.src)
        .then(d => {
          return writeFile(data.dest, d, {mode: data.mode});
        })
        .then(() => {
          return new Promise((resolve, reject) => {
            fs.utimes(data.dest, data.atime, data.mtime, err => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
        })
        .then(
          () => {
            events.onProgress(data.dest);
            cleanup();
          },
          err => {
            cleanup();
            throw err;
          },
        ));
    },
    CONCURRENT_QUEUE_ITEMS,
  );

  // we need to copy symlinks last as they could reference files we were copying
  const symlinkActions: Array<CopySymlinkAction> = (actions.filter(action => action.type === 'symlink'): any);
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
  events.onStart(actions.length);

  const fileActions: Array<LinkFileAction> = (actions.filter(action => action.type === 'link'): any);

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
  const symlinkActions: Array<CopySymlinkAction> = (actions.filter(action => action.type === 'symlink'): any);
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
      await fsSymlink(relative, dest);
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
  await promisify(fs.writeFile)(path, data);
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
