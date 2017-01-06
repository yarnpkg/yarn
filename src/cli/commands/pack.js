/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import type {IgnoreFilter} from '../../util/filter.js';
import * as fs from '../../util/fs.js';
import {sortFilter, ignoreLinesToRegex} from '../../util/filter.js';
import {MessageError} from '../../errors.js';

const zlib = require('zlib');
const path = require('path');
const tar = require('tar-stream');
const fs2 = require('fs');

const IGNORE_FILENAMES = [
  '.yarnignore',
  '.npmignore',
  '.gitignore',
];

const FOLDERS_IGNORE = [
  // never allow version control folders
  '.git',
  'CVS',
  '.svn',
  '.hg',

  'node_modules',
];

const DEFAULT_IGNORE = ignoreLinesToRegex([
  ...FOLDERS_IGNORE,

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
]);

const NEVER_IGNORE = ignoreLinesToRegex([
  // never ignore these files
  '!/package.json',
  '!/readme*',
  '!/+(license|licence)*',
  '!/+(changes|changelog|history)*',
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
  const pkg = await config.readRootManifest();
  const {bundledDependencies, files: onlyFiles} = pkg;

  // inlude required files
  let filters: Array<IgnoreFilter> = NEVER_IGNORE.slice();
  // include default filters unless `files` is used
  if (!onlyFiles) {
    filters = filters.concat(DEFAULT_IGNORE);
  }

  // include bundledDependencies
  if (bundledDependencies) {
    const folder = config.getFolder(pkg);
    filters = ignoreLinesToRegex(
      bundledDependencies.map((name): string => `!${folder}/${name}`),
      '.',
    );
  }

  // `files` field
  if (onlyFiles) {
    let lines = [
      '*', // ignore all files except those that are explicitly included with a negation filter
      '.*', // files with "." as first character have to be excluded explicitly
    ];
    lines = lines.concat(
      onlyFiles.map((filename: string): string => `!${filename}`),
    );
    const regexes = ignoreLinesToRegex(lines, '.');
    filters = filters.concat(regexes);
  }

  //
  const files = await fs.walk(config.cwd, null, new Set(FOLDERS_IGNORE));

  // create ignores
  for (const file of files) {
    if (IGNORE_FILENAMES.indexOf(path.basename(file.relative)) >= 0) {
      const raw = await fs.readFile(file.absolute);
      const lines = raw.split('\n');

      const regexes = ignoreLinesToRegex(lines, path.dirname(file.relative));
      filters = filters.concat(regexes);
    }
  }

  // files to definently keep, takes precedence over ignore filter
  const keepFiles: Set<string> = new Set();

  // files to definently ignore
  const ignoredFiles: Set<string> = new Set();

  // list of files that didn't match any of our patterns, if a directory in the chain above was matched
  // then we should inherit it
  const possibleKeepFiles: Set<string> = new Set();

  // apply filters
  sortFilter(files, filters, keepFiles, possibleKeepFiles, ignoredFiles);

  const packer = tar.pack();
  const compressor = packer.pipe(new zlib.Gzip());

  await addEntry(packer, {
    name: 'package',
    type: 'directory',
  });

  for (const name of keepFiles) {
    const loc = path.join(config.cwd, name);
    const stat = await fs.lstat(loc);

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

    const entry = {
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

  const normaliseScope = (name) => name[0] === '@' ? name.substr(1).replace('/', '-') : name;
  const filename = flags.filename || path.join(config.cwd, `${normaliseScope(pkg.name)}-v${pkg.version}.tgz`);

  const stream = await pack(config, config.cwd);

  await new Promise((resolve, reject) => {
    stream.pipe(fs2.createWriteStream(filename));
    stream.on('error', reject);
    stream.on('close', resolve);
  });

  reporter.success(reporter.lang('packWroteTarball', filename));
}
