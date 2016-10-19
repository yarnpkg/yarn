/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {registryNames} from '../../registries/index.js';
import {sortFilter, ignoreLinesToRegex} from '../../util/filter.js';
import {CLEAN_FILENAME} from '../../constants.js';
import * as fs from '../../util/fs.js';

const path = require('path');

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
  '.yarn-metadata.json',
  '.*.yml',
  '*.yml',

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
  const loc = path.join(config.cwd, CLEAN_FILENAME);
  const file = await fs.readFile(loc);
  const lines = file.split('\n');
  const filters = DEFAULT_FILTERS.concat(ignoreLinesToRegex(lines));

  let removedFiles = 0;
  let removedSize = 0;

  // build list of possible module folders
  const locs = new Set();
  if (config.modulesFolder) {
    locs.add(config.modulesFolder);
  }
  for (const name of registryNames) {
    const registry = config.registries[name];
    locs.add(path.join(config.cwd, registry.folder));
  }

  for (const folder of locs) {
    if (!(await fs.exists(folder))) {
      continue;
    }

    const spinner = reporter.activity();
    const files = await fs.walk(folder);
    const {ignoreFiles} = sortFilter(files, filters);
    spinner.end();

    const tick = reporter.progress(ignoreFiles.size);
    // TODO make sure `main` field of all modules isn't ignored

    for (const file of ignoreFiles) {
      const loc = path.join(folder, file);
      const stat = await fs.lstat(loc);
      removedSize += stat.size;
      removedFiles++;
    }

    for (const file of ignoreFiles) {
      const loc = path.join(folder, file);
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
  reporter.step(1, 2, reporter.lang('cleanCreatingFile', CLEAN_FILENAME));
  try {
    await fs.writeFile(path.join(config.cwd, CLEAN_FILENAME), '\n', {flag: 'wx'});
  } catch (e) {
    // The file exists and can not be replaced.
    // Catch is suppressed, because this error does not reflect a problem.
  }

  reporter.step(2, 2, reporter.lang('cleaning'));
  const {removedFiles, removedSize} = await clean(config, reporter);
  reporter.info(reporter.lang('cleanRemovedFiles', removedFiles));
  reporter.info(reporter.lang('cleanSavedSize', Number((removedSize / 1024 / 1024).toFixed(2))));
}
