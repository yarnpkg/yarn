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
export let unlink         = promisify(require("rimraf"));
export let mkdirp         = promisify(require("mkdirp"));
export let exists         = promisify(fs.exists, true);
export let lstat          = promisify(fs.lstat);
export let chmod          = promisify(fs.chmod);

let fsSymlink = promisify(fs.symlink);
let stripBOM  = require("strip-bom");

export async function copy(src: string, dest: string): Promise<void> {
  let srcStat = await lstat(src);

  if (await exists(dest)) {
    let destStat = await lstat(dest);

    if (srcStat.isFile() && destStat.isFile() && destStat.size === destStat.size) {
      // we can safely assume this is the same file
      return;
    }

    if (srcStat.isDirectory() && destStat.isDirectory()) {
      // remove files that aren't in source
      let destFiles = await readdir(dest);
      let srcFiles  = await readdir(src);

      let promises = destFiles.map(async (file) => {
        if (srcFiles.indexOf(file) < 0) {
          await unlink(path.join(dest, file));
        }
      });
      await Promise.all(promises);
    }

    if (srcStat.mode !== destStat.mode) {
      // different types
      await unlink(dest);
    }
  }

  if (srcStat.isDirectory()) {
    // create dest directory
    await mkdirp(dest);

    // get all files in source directory
    let files = await readdir(src);

    // copy all files from source to dest
    let promises = files.map((file) => {
      return copy(path.join(src, file), path.join(dest, file));
    });
    await Promise.all(promises);
  } else if (srcStat.isFile()) {
    return new Promise((resolve, reject) => {
      let readStream = fs.createReadStream(src);
      let writeStream = fs.createWriteStream(dest, { mode: srcStat.mode });

      readStream.on("error", reject);
      writeStream.on("error", reject);

      writeStream.on("open", function() {
        readStream.pipe(writeStream);
      });

      writeStream.once("finish", function() {
        resolve();
      });
    });
  } else {
    throw new Error("unsure how to copy this?");
  }
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
