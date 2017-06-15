/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import type {IgnoreFilter} from '../../util/filter.js';
import * as fs from '../../util/fs.js';
import {sortFilter, ignoreLinesToRegex, filterOverridenGitignores} from '../../util/filter.js';
import {MessageError} from '../../errors.js';

const zlib = require('zlib');
const path = require('path');
const tar = require('tar-fs');
const fs2 = require('fs');

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

export async function packTarball(
  config: Config,
  {mapHeader}: {mapHeader?: Object => Object} = {},
): Promise<stream$Duplex> {
  const pkg = await config.readRootManifest();
  const {bundledDependencies, main, files: onlyFiles} = pkg;

  // include required files
  let filters: Array<IgnoreFilter> = NEVER_IGNORE.slice();
  // include default filters unless `files` is used
  if (!onlyFiles) {
    filters = filters.concat(DEFAULT_IGNORE);
  }
  if (main) {
    filters = filters.concat(ignoreLinesToRegex(['!/' + main]));
  }

  // include bundledDependencies
  if (bundledDependencies) {
    const folder = config.getFolder(pkg);
    filters = ignoreLinesToRegex(bundledDependencies.map((name): string => `!${folder}/${name}`), '.');
  }

  // `files` field
  if (onlyFiles) {
    let lines = [
      '*', // ignore all files except those that are explicitly included with a negation filter
      '.*', // files with "." as first character have to be excluded explicitly
    ];
    lines = lines.concat(
      onlyFiles.map((filename: string): string => `!${filename}`),
      onlyFiles.map((filename: string): string => `!${path.join(filename, '**')}`),
    );
    const regexes = ignoreLinesToRegex(lines, '.');
    filters = filters.concat(regexes);
  }

  const files = await fs.walk(config.cwd, null, new Set(FOLDERS_IGNORE));
  const dotIgnoreFiles = filterOverridenGitignores(files);

  // create ignores
  for (const file of dotIgnoreFiles) {
    const raw = await fs.readFile(file.absolute);
    const lines = raw.split('\n');

    const regexes = ignoreLinesToRegex(lines, path.dirname(file.relative));
    filters = filters.concat(regexes);
  }

  // files to definitely keep, takes precedence over ignore filter
  const keepFiles: Set<string> = new Set();

  // files to definitely ignore
  const ignoredFiles: Set<string> = new Set();

  // list of files that didn't match any of our patterns, if a directory in the chain above was matched
  // then we should inherit it
  const possibleKeepFiles: Set<string> = new Set();

  // apply filters
  sortFilter(files, filters, keepFiles, possibleKeepFiles, ignoredFiles);

  const packer = tar.pack(config.cwd, {
    ignore: name => {
      const relative = path.relative(config.cwd, name);
      // Don't ignore directories, since we need to recurse inside them to check for unignored files.
      if (fs2.lstatSync(name).isDirectory()) {
        const isParentOfKeptFile = Array.from(keepFiles).some(name => !path.relative(relative, name).startsWith('..'));
        return !isParentOfKeptFile;
      }
      // Otherwise, ignore a file if we're not supposed to keep it.
      return !keepFiles.has(relative);
    },
    map: header => {
      const suffix = header.name === '.' ? '' : `/${header.name}`;
      header.name = `package${suffix}`;
      delete header.uid;
      delete header.gid;
      return mapHeader ? mapHeader(header) : header;
    },
  });

  return packer;
}

export async function pack(config: Config, dir: string): Promise<stream$Duplex> {
  const packer = await packTarball(config);
  const compressor = packer.pipe(new zlib.Gzip());

  return compressor;
}

export function setFlags(commander: Object) {
  commander.option('-f, --filename <filename>', 'filename');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const pkg = await config.readRootManifest();
  if (!pkg.name) {
    throw new MessageError(reporter.lang('noName'));
  }
  if (!pkg.version) {
    throw new MessageError(reporter.lang('noVersion'));
  }

  const normaliseScope = name => (name[0] === '@' ? name.substr(1).replace('/', '-') : name);
  const filename = flags.filename || path.join(config.cwd, `${normaliseScope(pkg.name)}-v${pkg.version}.tgz`);

  const stream = await pack(config, config.cwd);

  await new Promise((resolve, reject) => {
    stream.pipe(fs2.createWriteStream(filename));
    stream.on('error', reject);
    stream.on('close', resolve);
  });

  reporter.success(reporter.lang('packWroteTarball', filename));
}
