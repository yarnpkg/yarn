/* @flow */

import BlockingQueue from './blocking-queue.js';
import * as promise from './promise.js';
import {promisify} from './promise.js';
import map from './map.js';

const path = require('path');
const fs = require('fs');

export const lockQueue = new BlockingQueue('fs lock');

export const readFileBuffer = promisify(fs.readFile);
export const writeFile: (path: string, data: string) => Promise<void> = promisify(fs.writeFile);
export const readlink: (path: string, opts: void) => Promise<string> = promisify(fs.readlink);
export const realpath: (path: string, opts: void) => Promise<string> = promisify(fs.realpath);
export const readdir: (path: string, opts: void) => Promise<Array<string>> = promisify(fs.readdir);
export const rename: (oldPath: string, newPath: string) => Promise<void> = promisify(fs.rename);
export const access: (path: string, mode?: number) => Promise<void> = promisify(fs.access);
export const stat: (path: string) => Promise<fs.Stats> = promisify(fs.stat);
export const unlink: (path: string) => Promise<void> = promisify(require('rimraf'));
export const mkdirp: (path: string) => Promise<void> = promisify(require('mkdirp'));
export const exists: (path: string) => Promise<boolean>  = promisify(fs.exists, true);
export const lstat: (path: string) => Promise<fs.Stats> = promisify(fs.lstat);
export const chmod: (path: string, mode: number | string) => Promise<void> = promisify(fs.chmod);

const fsSymlink: (
  target: string,
  path: string,
  type?: 'dir' | 'file' | 'junction'
) => Promise<void> = promisify(fs.symlink);
const invariant = require('invariant');
const stripBOM = require('strip-bom');

const noop = () => {};

export type CopyQueueItem = {
  src: string,
  dest: string,
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
  mode: number
};

type CopySymlinkAction = {
  type: 'symlink',
  dest: string,
  linkname: string,
};

type CopyActions = Array<CopyFileAction | CopySymlinkAction>;

type PossibleExtraneous = void | false | Iterable<string>;

type CopyOptions = {
  onProgress: (dest: string) => void,
  onStart: (num: number) => void,
  possibleExtraneous: PossibleExtraneous,
  ignoreBasenames: Array<string>,
};

async function buildActionsForCopy(
  queue: CopyQueue,
  events: CopyOptions,
  possibleExtraneousSeed: PossibleExtraneous,
): Promise<CopyActions> {
  const possibleExtraneous: Set<string> = new Set(possibleExtraneousSeed || []);
  const noExtraneous = possibleExtraneousSeed === false;
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

  // custom concurrency logic as we're always executing stacks of 4 queue items
  // at a time due to the requirement to push items onto the queue
  while (queue.length) {
    const items = queue.splice(0, 4);
    await Promise.all(items.map(build));
  }

  // remove all extraneous files that weren't in the tree
  if (!noExtraneous) {
    for (const loc of possibleExtraneous) {
      if (!files.has(loc)) {
        await unlink(loc);
      }
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

    if (await exists(dest)) {
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
        }
      }

      if (bothFiles && srcStat.size === destStat.size && +srcStat.mtime === +destStat.mtime) {
        // we can safely assume this is the same file
        onDone();
        return;
      }

      if (bothSymlinks && await readlink(src) === await readlink(dest)) {
        // if both symlinks are the same then we can continue on
        onDone();
        return;
      }

      if (bothFolders && !noExtraneous) {
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

export function copy(src: string, dest: string): Promise<void> {
  return copyBulk([{src, dest}]);
}

export async function copyBulk(
  queue: CopyQueue,
  _events?: {
    onProgress?: ?(dest: string) => void,
    onStart?: ?(num: number) => void,
    possibleExtraneous?: PossibleExtraneous,
    ignoreBasenames?: Array<string>,
  },
): Promise<void> {
  const events: CopyOptions = {
    onStart: (_events && _events.onStart) || noop,
    onProgress: (_events && _events.onProgress) || noop,
    possibleExtraneous: _events ? _events.possibleExtraneous : [],
    ignoreBasenames: (_events && _events.ignoreBasenames) || [],
  };

  const actions: CopyActions = await buildActionsForCopy(queue, events, events.possibleExtraneous);
  events.onStart(actions.length);

  const fileActions: Array<CopyFileAction> = (actions.filter((action) => action.type === 'file'): any);
  await promise.queue(fileActions, (data): Promise<void> => new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(data.src);
    const writeStream = fs.createWriteStream(data.dest, {mode: data.mode});

    readStream.on('error', reject);
    writeStream.on('error', reject);

    writeStream.on('open', function() {
      readStream.pipe(writeStream);
    });

    writeStream.once('finish', function() {
      fs.utimes(data.dest, data.atime, data.mtime, function(err) {
        if (err) {
          reject(err);
        } else {
          events.onProgress(data.dest);
          resolve();
        }
      });
    });
  }), 4);

  // we need to copy symlinks last as the could reference files we were copying
  const symlinkActions: Array<CopySymlinkAction> = (actions.filter((action) => action.type === 'symlink'): any);
  await promise.queue(symlinkActions, (data): Promise<void> => {
    return symlink(path.resolve(path.dirname(data.dest), data.linkname), data.dest);
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

export async function readJsonAndFile(loc: string): Promise<{
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

    if (stats.isSymbolicLink() && await exists(dest)) {
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
      const relative = path.relative(path.dirname(dest), src);
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
    filenames = filenames.filter((name) => !ignoreBasenames.has(name));
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

  return (Math.ceil(size / blockSize) * blockSize);
}

export function normalizeOS(body: string): string {
  return body.replace(/\r\n/g, '\n');
}
