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

import type { PackageInfo } from "../types.js";
import type { RegistryNames } from "../registries/index.js";
import BlockingQueue from "./blocking-queue.js";
import { registries } from "../registries/index.js";
import * as constants from "../constants.js";
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
export let copy           = promisify(require("ncp"));

let fsSymlink = promisify(fs.symlink);
let stripBOM  = require("strip-bom");

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

export async function isValidModuleDest(dest: string): Promise<boolean> {
  if (!(await exists(dest))) {
    return false;
  }

  if (!(await exists(path.join(dest, constants.METADATA_FILENAME)))) {
    return false;
  }

  return true;
}

export async function readPackageMetadata(dir: string): Promise<{
  registry: RegistryNames,
  hash: string,
  package: PackageInfo
}> {
  let metadata = await readJson(path.join(dir, constants.METADATA_FILENAME));
  let pkg = await readPackageJson(dir, metadata.registry);

  return {
    package: pkg,
    hash: metadata.hash,
    registry: metadata.registry
  };
}

export async function readPackageJson(dir: string, priorityRegistry?: RegistryNames): Promise<Object> {
  let metadataLoc = path.join(dir, constants.METADATA_FILENAME);
  if (!priorityRegistry && await exists(metadataLoc)) {
    ({ registry: priorityRegistry } = await readJson(metadataLoc));
  }

  if (priorityRegistry) {
    let file = await tryPackageJson(dir, priorityRegistry);
    if (file) return file;
  }

  for (let registry of Object.keys(registries)) {
    if (priorityRegistry === registry) continue;

    let file = await tryPackageJson(dir, registry);
    if (file) return file;
  }

  throw new Error(`Couldn't find a package.json in ${dir}`);
}

async function tryPackageJson(dir: string, registry: RegistryNames): ?Object {
  let filename = registries[registry].filename;
  let loc = path.join(dir, filename);
  if (await exists(loc)) {
    let data = await readJson(loc);
    data.registry = registry;
    return data;
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
    await fsSymlink(src, dest, "junction");
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
