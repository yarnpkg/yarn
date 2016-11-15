/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import minimatch from 'minimatch';
import {MessageError} from '../../errors.js';
import {ConcatStream} from '../../util/stream.js';

const zlib = require('zlib');
const path = require('path');
const tar = require('tar-fs');
const fs2 = require('fs');

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

export function pack(config: Config): stream$Duplex {
  const packer = tar.pack(config.cwd, {
    ignore: (name) => {

      const neverIgnore = NEVER_IGNORE.map((pattern) => minimatch(name, pattern, {matchBase: true}));
      // if this matches one of the patterns which should never be ignored,
      // do not ignore -> exit early
      if (neverIgnore.reduce((a, b) => a || b, false)) {
        return false;
      }
      // this could be made more efficient,
      // focus for now was to keep it simple and get all edge-cases to work
      // in particular: stop evaluating ignore rules if one matches
      const ignores = DEFAULT_IGNORE
        .concat(IGNORE_FILENAMES)
        .map((pattern) => minimatch(name, pattern, {matchBase: true}));
      // evaluate all ignore rules
      // const ignores = DEFAULT_IGNORE.map((pattern) => minimatch(name, pattern, {matchBase: true}));
      // if one ignore rule evaluated to true, this path should be ignored
      return ignores.reduce((a, b) => a || b, false);
    },
    map: (header) => {
      // rewrite paths: entire package content is in folder "package"
      header.name = 'package/' + header.name;
      return header;
    },
  })
  .pipe(new zlib.Gzip());

  return packer;
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

  // get the pack-stream
  const stream = pack(config);
  // first read package content, create archive, write to buffer
  const buffer = await new Promise((resolve, reject) => {
    stream.pipe(new ConcatStream(resolve)).on('error', reject);
  });
  // then write the buffer to a file
  // (need buffer to avoid read/write conflicts)
  const filename = flags.filename || `${pkg.name}-v${pkg.version}.tgz`;

  await new Promise((resolve, reject) => {
    fs2.writeFile(path.join(config.cwd, filename), buffer, (err) => {
      if (err) {
        reporter.info('error writing to file...');
        reject(err);
      }
      resolve();
    });
  });
  reporter.success(reporter.lang('packWroteTarball', filename));
}
