/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {registryNames} from '../../registries/index.js';
import {sortFilter, ignoreLinesToRegex} from '../../util/filter.js';
import {CLEAN_FILENAME} from '../../constants.js';
import * as fs from '../../util/fs.js';

let path = require('path');

export const requireLockfile = true;
export const noArguments = true;

const DEFAULT_FILTERS = ignoreLinesToRegex([
  // test directories
  '__tests__',
  'test',
  'tests',
  'powered-test',

  // asset directories
  'docs',
  'doc',
  'website',
  'images',
  'assets',

  // examples
  'example',
  'examples',

  // code coverage/test data
  'coverage',
  '.nyc_output',

  // build scripts
  'Makefile',
  'Gulpfile.js',
  'Gruntfile.js',

  // configs
  '.tern-project',
  '.gitattributes',
  '.editorconfig',
  '.*ignore',
  '.eslintrc',
  '.jshintrc',
  '.flowconfig',
  '.documentup.json',
  '.kpm-metadata.json',
  '.yarn-metadata.json',
  '.*.yml',
  '*.yml',

  // compiled files
  '*.min.js',
  '*-min.js',

  //
  '*.gz',
  '*.md',

  //
  'CHANGES',
  'HISTORY',
]);

export async function clean(config: Config, reporter: Reporter): Promise<{
  removedFiles: number,
  removedSize: number,
}> {
  let loc = path.join(config.cwd, CLEAN_FILENAME);
  let file = await fs.readFile(loc);
  let lines = file.split('\n');
  let filters = DEFAULT_FILTERS.concat(ignoreLinesToRegex(lines));

  let removedFiles = 0;
  let removedSize = 0;

  // build list of possible module folders
  let locs = new Set();
  if (config.modulesFolder) {
    locs.add(config.modulesFolder);
  }
  for (let name of registryNames) {
    let registry = config.registries[name];
    locs.add(path.join(config.cwd, registry.folder));
  }

  for (let folder of locs) {
    if (!(await fs.exists(folder))) {
      continue;
    }

    let spinner = reporter.activity();
    let files = await fs.walk(folder);
    let {ignoreFiles} = sortFilter(files, filters);
    spinner.end();

    let tick = reporter.progress(ignoreFiles.size);
    // TODO make sure `main` field of all modules isn't ignored

    for (let file of ignoreFiles) {
      let loc = path.join(folder, file);
      let stat = await fs.lstat(loc);
      removedSize += stat.size;
      removedFiles++;
    }

    for (let file of ignoreFiles) {
      let loc = path.join(folder, file);
      await fs.unlink(loc);
      tick();
    }
  }

  return {removedFiles, removedSize};
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  reporter.step(1, 2, `Creating ${CLEAN_FILENAME}`);
  await fs.writeFile(path.join(config.cwd, CLEAN_FILENAME), '\n');

  reporter.step(2, 2, 'Cleaning modules');
  let {removedFiles, removedSize} = await clean(config, reporter);
  reporter.info(reporter.lang('cleanRemovedFiles', removedFiles));
  reporter.info(reporter.lang('cleanSavedSize', (removedSize / 1024 / 1024).toFixed(2)));
}
