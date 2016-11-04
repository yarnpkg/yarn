/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import minimatch from 'minimatch';
import {MessageError} from '../../errors.js';
import * as fs from '../../util/fs.js';

const zlib = require('zlib');
const path = require('path');
const tar = require('tar-fs');
const fs2 = require('fs');
const os = require('os');

const IGNORE_FILENAMES = [
  '.yarnignore',
  '.npmignore',
  '.gitignore',
];

const DEFAULT_IGNORE = [
  // never allow version control folders
  '.git',
  'CVS',
  '.svn',
  '.hg',

  // ignore cruft
  'yarn.lock',
  '.lock-wscript',
  '.wafpickle-{0..9}',
  '*.swp',
  '._*',
  'npm-debug.log',
  'yarn-error.log',
  '.npmrc',
  '.yarnrc',
  '.npmignore',
  '.gitignore',
  '.DS_Store',
  'node_modules',
];

const NEVER_IGNORE = [
  // never ignore these files
  'package.json',
  'readme*',
  '+(license|licence)*',
  '+(changes|changelog|history)*',
];

export function setFlags(commander: Object) {
  commander.option('-f, --filename <filename>', 'filename');
}

export async function run(
 config: Config,
 reporter: Reporter,
 flags: Object,
 args: Array<string>,
): Promise<void> {
  const pkg = await config.readRootManifest();
  if (!pkg.name) {
    throw new MessageError(reporter.lang('noName'));
  }
  if (!pkg.version) {
    throw new MessageError(reporter.lang('noVersion'));
  }

  // create a temp working dir to avoid r/w conflicts during tar
  const filename = flags.filename || `${pkg.name}-v${pkg.version}.tgz`;
  const tmpdir = path.join(
    os.tmpdir(),
    `yarn-pack-${pkg.name}-${Math.random()}`,
  );
  await fs.mkdirp(tmpdir);
  await new Promise((resolve, reject) => {
    tar.pack(config.cwd, {
      ignore: (name) => {
        // this could be made more efficient,
        // focus for now was to keep it simple and get all edge-cases to work
        // in particular: stop evaluating ignore rules if one matches

        // evaluate all ignore rules
        const ignores = DEFAULT_IGNORE.map((pattern) => minimatch(name, pattern, {matchBase: true}));
        // if one ignore rule evaluated to true, this path should be ignored
        return ignores.reduce((a, b) => a || b, false);
      },
      map: (header) => {
        // rewrite paths: entire package content is in folder "package"
        header.name = 'package/' + header.name;
        return header;
      },
    })
    .pipe(new zlib.Gzip())
    // first write to tmp dir to avoid read/write getting in the ways of each other
    .pipe(fs2.createWriteStream(path.join(tmpdir, filename)))
    .on('error', reject)
    .on('close', resolve);
  });

  reporter.success(reporter.lang('packWroteTarball', path.join(tmpdir, filename)));

  // move tarball from tmpdir to working cwd
  await fs.rename(path.join(tmpdir, filename), path.join(config.cwd, filename));
  // cleanup -> remove tmp-dir
  await fs.unlink(tmpdir);
}
