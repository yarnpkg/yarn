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
import {removeSuffix} from '../../util/misc.js';
import * as fs from '../../util/fs.js';
let tar = require('tar-stream');

let minimatch = require('minimatch');
let zlib = require('zlib');
let path = require('path');
let fs2 = require('fs');

type IgnoreFilter = {
  base: string,
  isNegation: boolean,
  regex: RegExp,
};

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

function matchesFilter(filter: IgnoreFilter, loc: string): boolean {
  if (filter.base) {
    loc = path.relative(filter.base, loc);
  }
  return filter.regex.test(loc) || filter.regex.test(`/${loc}`);
}

function ignoreLinesToRegex(lines: Array<string>, base: string = '.'): Array<IgnoreFilter> {
  return lines
    // remove comments
    .map((line): string => line.replace(/# (.*?)$/g, '').trim())

    // remove empty lines
    .filter((line): boolean => !!line)

    // create regex
    .map((pattern): IgnoreFilter => {
      let isNegation = false;

      // hide the fact that it's a negation from minimatch since we'll handle this specifally
      // ourselves
      if (pattern[0] === '!') {
        isNegation = true;
        pattern = pattern.slice(1);
      }

      // remove trailing slash
      pattern = removeSuffix(pattern, '/');

      return {
        base,
        isNegation,
        regex: minimatch.makeRe(pattern, {nocase: true}),
      };
    });
}

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
  for (let file of files) {
    let keep = false;

    // always keep a file if a ! pattern matches it
    for (let filter of filters) {
      if (filter.isNegation && matchesFilter(filter, file.relative)) {
        keep = true;
        break;
      }
    }

    //
    if (keep) {
      keepFiles.add(file.relative);
      continue;
    }

    // otherwise don't keep it if a pattern matches it
    keep = true;
    for (let filter of filters) {
      if (!filter.isNegation && matchesFilter(filter, file.relative)) {
        keep = false;
        break;
      }
    }

    if (keep) {
      possibleKeepFiles.add(file.relative);
    } else {
      ignoredFiles.add(file.relative);
    }
  }

  //
  for (let file of possibleKeepFiles) {
    let parts = path.dirname(file).split(path.sep);

    while (parts.length) {
      let folder = parts.join(path.sep);
      if (ignoredFiles.has(folder)) {
        ignoredFiles.add(file);
        break;
      }
      parts.pop();
    }
  }

  //
  for (let file of possibleKeepFiles) {
    if (!ignoredFiles.has(file)) {
      keepFiles.add(file);
    }
  }

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
