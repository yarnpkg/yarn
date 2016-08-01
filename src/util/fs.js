/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import BlockingQueue from "./blocking-queue.js";
import * as promise from "./promise.js";
import { promisify } from "./promise.js";
import map from "./map.js";

let path = require("path");
let fs   = require("fs");

export let lockQueue = new BlockingQueue("fs lock");

export let readFileBuffer = promisify(fs.readFile);
export let writeFile      = promisify(fs.writeFile);
export let realpath       = promisify(fs.realpath);
export let readdir        = promisify(fs.readdir);
export let rename         = promisify(fs.rename);
export let access         = promisify(fs.access);
export let unlink         = promisify(require("rimraf"));
export let mkdirp         = promisify(require("mkdirp"));
export let exists         = promisify(fs.exists, true);
export let lstat          = promisify(fs.lstat);
export let chmod          = promisify(fs.chmod);

let fsSymlink = promisify(fs.symlink);
let invariant = require("invariant");
let stripBOM  = require("strip-bom");

type CopyQueue = Array<{
  src: string,
  dest: string,
  onFresh?: ?() => void,
  onDone?: ?() => void,
}>;

type CopyActions = Array<{
  src: string,
  dest: string,
  atime: number,
  mtime: number,
  mode: number
}>;

type CopyEvents = {
  onProgress: (dest: string) => void,
  onStart: (num: number) => void
};

async function buildActionsForCopy(queue: CopyQueue, events: CopyEvents): Promise<CopyActions> {
  // initialise events
  for (let item of queue) {
    item.onDone = () => {
      events.onProgress(item.dest);
    };
  }
  events.onStart(queue.length);

  // start building actions
  let actions: CopyActions = [];
  await init();
  return actions;

  // custom concurrency logic as we're always executing stacks of 4 queue items
  // at a time due to the requirement to push items onto the queue
  async function init(): Promise<CopyActions> {
    let items = queue.splice(0, 4);
    if (!items.length) return;

    await Promise.all(items.map(build));
    return init();
  }

  //
  async function build(data) {
    let { src, dest, onFresh } = data;
    let onDone = data.onDone || (() => {});
    let srcStat = await lstat(src);
    let srcFiles;

    if (srcStat.isDirectory()) {
      srcFiles = await readdir(src);
    }

    if (await exists(dest)) {
      let destStat = await lstat(dest);

      let bothFiles   = srcStat.isFile() && destStat.isFile();
      let bothFolders = !bothFiles && srcStat.isDirectory() && destStat.isDirectory();

      if (srcStat.mode !== destStat.mode) {
        if (bothFiles) {
          await access(dest, srcStat.mode);
        } else {
          await unlink(dest);
          return build(data);
        }
      }

      if (bothFiles && srcStat.size === destStat.size && +srcStat.mtime === +destStat.mtime) {
        // we can safely assume this is the same file
        onDone();
        return;
      }

      if (bothFolders) {
        // remove files that aren't in source
        let destFiles = await readdir(dest);
        invariant(srcFiles, "src files not initialised");

        for (let file of destFiles) {
          if (file === "node_modules") continue;

          if (srcFiles.indexOf(file) < 0) {
            await unlink(path.join(dest, file));
          }
        }
      }
    }

    if (srcStat.isDirectory()) {
      await mkdirp(dest);

      // push all files to queue
      invariant(srcFiles, "src files not initialised");
      let remaining = srcFiles.length;
      if (!remaining) onDone();
      for (let file of srcFiles) {
        queue.push({
          onFresh,
          src: path.join(src, file),
          dest: path.join(dest, file),
          onDone: () => {
            if (--remaining === 0) onDone();
          }
        });
      }
    } else if (srcStat.isFile()) {
      if (onFresh) onFresh();
      actions.push({
        src,
        dest,
        atime: srcStat.atime,
        mtime: srcStat.mtime,
        mode: srcStat.mode
      });
      onDone();
    } else {
      throw new Error("unsure how to copy this?");
    }
  }
}

export function copy(src: string, dest: string): Promise<void> {
  return copyBulk([{ src, dest }]);
}

export async function copyBulk(queue: CopyQueue, _events?: CopyEvents): Promise<void> {
  let events: CopyEvents = _events || {
    onStart: () => {},
    onProgress: () => {},
  };

  let actions: CopyActions = await buildActionsForCopy(queue, events);

  events.onStart(actions.length);

  await promise.queue(actions, (data): Promise<void> => new Promise((resolve, reject) => {
    let readStream = fs.createReadStream(data.src);
    let writeStream = fs.createWriteStream(data.dest, { mode: data.mode });

    readStream.on("error", reject);
    writeStream.on("error", reject);

    writeStream.on("open", function () {
      readStream.pipe(writeStream);
    });

    writeStream.once("finish", function () {
      fs.utimes(data.dest, data.atime, data.mtime, function (err) {
        if (err) {
          reject(err);
        } else {
          events.onProgress(data.dest);
          resolve();
        }
      });
    });
  }), 4);
}

export async function readFile(loc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(loc, "utf8", function (err, content) {
      if (err) {
        reject(err);
      } else {
        resolve(content);
      }
    });
  });
}

export async function readJson(loc: string): Promise<Object> {
  let file = await readFile(loc);
  try {
    return map(JSON.parse(stripBOM(file)));
  } catch (err) {
    err.message = `${loc}: ${err.message}`;
    throw err;
  }
}

export async function find(filename: string, dir: string): Promise<string | false> {
  let parts = dir.split(path.sep);

  while (parts.length) {
    let loc = parts.concat(filename).join(path.sep);

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
    let stats = await lstat(dest);

    if (stats.isSymbolicLink() && await exists(dest)) {
      let resolved = await realpath(dest);
      if (resolved === src) return;
    }

    await unlink(dest);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  try {
    if (process.platform === "win32") {
      // use directory junctions if possible on win32, this requires absolute paths
      await fsSymlink(src, dest, "junction");
    } else {
      // use relative paths otherwise which will be retained if the directory is moved
      let relative = path.relative(path.dirname(dest), src);
      await fsSymlink(relative, dest);
    }
  } catch (err) {
    if (err.code === "EEXIST") {
      // race condition
      return symlink(src, dest);
    } else {
      throw err;
    }
  }
}

export async function walk(dir: string, relativeDir?: string): Promise<Array<{
  relative: string,
  absolute: string
}>> {
  let files = [];

  for (let name of await readdir(dir)) {
    let relative = relativeDir ? path.join(relativeDir, name) : name;
    let loc = path.join(dir, name);
    if ((await lstat(loc)).isDirectory()) {
      files = files.concat(await walk(loc, relative));
    } else {
      files.push({ relative, absolute: loc });
    }
  }

  return files;
}
