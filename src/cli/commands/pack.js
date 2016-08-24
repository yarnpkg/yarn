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

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import type {IgnoreFilter} from '../../util/filter.js';
import * as fs from '../../util/fs.js';
import {sortFilter, ignoreLinesToRegex} from '../../util/filter.js';

let zlib = require('zlib');
let path = require('path');
let tar = require('tar-stream');
let fs2 = require('fs');

const IGNORE_FILENAMES = [
  '.kpmignore',
  '.npmignore',
  '.gitignore',
];

const DEFAULT_IGNORE = ignoreLinesToRegex([
  // never allow version control folders
  '.git',
  'CVS',
  '.svn',
  '.hg',

  // ignore cruft
  'kpm.lock',
  '.lock-wscript',
  '.wafpickle-{0..9}',
  '*.swp',
  '._*',
  'npm-debug.log',
  '.npmrc',
  '.kpmrc',
  '.npmignore',
  '.gitignore',
  '.DS_Store',
  'node_modules',

  // never ignore these files
  '!package.json',
  '!readme*',
  '!+(license|licence)*',
  '!+(changes|changelog|history)*',
]);

function addEntry(packer: any, entry: Object, buffer?: ?Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    packer.entry(entry, buffer, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export async function pack(config: Config, dir: string): Promise<stream$Duplex> {
  let pkg = await config.readManifest(config.cwd);

  //
  let filters: Array<IgnoreFilter> = DEFAULT_IGNORE.slice();

  //
  if (pkg.bundledDependencies) {
    let folder = config.getFolder(pkg);
    filters = ignoreLinesToRegex(
      pkg.bundledDependencies.map((name): string => `!${folder}/${name}`),
      '.',
    );
  }

  //
  let files = await fs.walk(config.cwd);

  // create ignores
  for (let file of files) {
    if (IGNORE_FILENAMES.indexOf(path.basename(file.relative)) >= 0) {
      let raw = await fs.readFile(file.absolute);
      let lines = raw.split('\n');

      let regexes = ignoreLinesToRegex(lines, path.dirname(file.relative));
      filters = filters.concat(regexes);
    }
  }

  // files to definently keep, takes precedence over ignore filter
  let keepFiles: Set<string> = new Set();

  // files to definently ignore
  let ignoredFiles: Set<string> = new Set();

  // list of files that didn't match any of our patterns, if a directory in the chain above was matched
  // then we should inherit it
  let possibleKeepFiles: Set<string> = new Set();

  //
  sortFilter(files, filters, keepFiles, possibleKeepFiles, ignoredFiles);

  // TODO files property
  // TODO throw error on possible suspect file patterns

  let packer = tar.pack();
  let compressor = packer.pipe(new zlib.Gzip());

  await addEntry(packer, {
    name: 'package',
    type: 'directory',
  });

  for (let name of keepFiles) {
    let loc = path.join(config.cwd, name);
    let stat = await fs.lstat(loc);

    let type: ?string;
    let buffer: ?Buffer;
    let linkname: ?string;
    if (stat.isDirectory()) {
      type = 'directory';
    } else if (stat.isFile()) {
      buffer = await fs.readFileRaw(loc);
      type = 'file';
    } else if (stat.isSymbolicLink()) {
      type = 'symlink';
      linkname = await fs.readlink(loc);
    } else {
      throw new Error();
    }

    let entry = {
      name: `package/${name}`,
      size: stat.size,
      mode: stat.mode,
      mtime: stat.mtime,
      type,
      linkname,
    };

    await addEntry(packer, entry, buffer);
  }

  packer.finalize();

  return compressor;
}

export function setFlags(commander: Object) {
  commander.option('-f, --filename [filename]', 'filename');
}

export async function run(
 config: Config,
 reporter: Reporter,
 flags: Object,
 args: Array<string>,
): Promise<void> {
  let pkg = await config.readManifest(config.cwd);
  let filename = flags.filename || path.join(config.cwd, `${pkg.name}-v${pkg.version}.tgz`);

  let stream = await pack(config, config.cwd);

  await new Promise((resolve, reject) => {
    stream.pipe(fs2.createWriteStream(filename));
    stream.on('error', reject);
    stream.on('close', resolve);
  });

  reporter.success(`Wrote tarball to ${filename}`);
}
