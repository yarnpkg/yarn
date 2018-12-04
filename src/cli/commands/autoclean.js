/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {registryNames} from '../../registries/index.js';
import {sortFilter, ignoreLinesToRegex} from '../../util/filter.js';
import {CLEAN_FILENAME} from '../../constants.js';
import * as fs from '../../util/fs.js';

const invariant = require('invariant');
const path = require('path');

export const requireLockfile = true;
export const noArguments = true;

const DEFAULT_FILTER = `
# test directories
__tests__
test
tests
powered-test

# asset directories
docs
doc
website
images
assets

# examples
example
examples

# code coverage directories
coverage
.nyc_output

# build scripts
Makefile
Gulpfile.js
Gruntfile.js

# configs
appveyor.yml
circle.yml
codeship-services.yml
codeship-steps.yml
wercker.yml
.tern-project
.gitattributes
.editorconfig
.*ignore
.eslintrc
.jshintrc
.flowconfig
.documentup.json
.yarn-metadata.json
.travis.yml

# misc
*.md
`.trim();

export async function clean(
  config: Config,
  reporter: Reporter,
): Promise<{
  removedFiles: number,
  removedSize: number,
}> {
  const loc = path.join(config.lockfileFolder, CLEAN_FILENAME);
  const file = await fs.readFile(loc);
  const lines = file.split('\n');
  const filters = ignoreLinesToRegex(lines);

  let removedFiles = 0;
  let removedSize = 0;

  // build list of possible module folders
  const locs = new Set();
  if (config.modulesFolder) {
    locs.add(config.modulesFolder);
  }
  for (const name of registryNames) {
    const registry = config.registries[name];
    locs.add(path.join(config.lockfileFolder, registry.folder));
  }

  const workspaceRootFolder = config.workspaceRootFolder;
  if (workspaceRootFolder) {
    const manifest = await config.findManifest(workspaceRootFolder, false);
    invariant(manifest && manifest.workspaces, 'We must find a manifest with a "workspaces" property');

    const workspaces = await config.resolveWorkspaces(workspaceRootFolder, manifest);

    for (const workspaceName of Object.keys(workspaces)) {
      for (const name of registryNames) {
        const registry = config.registries[name];
        locs.add(path.join(workspaces[workspaceName].loc, registry.folder));
      }
    }
  }

  for (const folder of locs) {
    if (!await fs.exists(folder)) {
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

async function runInit(cwd: string, reporter: Reporter): Promise<void> {
  reporter.step(1, 1, reporter.lang('cleanCreatingFile', CLEAN_FILENAME));
  const cleanLoc = path.join(cwd, CLEAN_FILENAME);
  await fs.writeFile(cleanLoc, `${DEFAULT_FILTER}\n`, {flag: 'wx'});
  reporter.info(reporter.lang('cleanCreatedFile', CLEAN_FILENAME));
}

async function runAutoClean(config: Config, reporter: Reporter): Promise<void> {
  reporter.step(1, 1, reporter.lang('cleaning'));
  const {removedFiles, removedSize} = await clean(config, reporter);
  reporter.info(reporter.lang('cleanRemovedFiles', removedFiles));
  reporter.info(reporter.lang('cleanSavedSize', Number((removedSize / 1024 / 1024).toFixed(2))));
}

async function checkForCleanFile(cwd: string): Promise<boolean> {
  const cleanLoc = path.join(cwd, CLEAN_FILENAME);
  const exists = await fs.exists(cleanLoc);
  return exists;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const cleanFileExists = await checkForCleanFile(config.cwd);

  if (flags.init && cleanFileExists) {
    reporter.info(reporter.lang('cleanAlreadyExists', CLEAN_FILENAME));
  } else if (flags.init) {
    await runInit(config.cwd, reporter);
  } else if (flags.force && cleanFileExists) {
    await runAutoClean(config, reporter);
  } else if (cleanFileExists) {
    reporter.info(reporter.lang('cleanRequiresForce', CLEAN_FILENAME));
  } else {
    reporter.info(reporter.lang('cleanDoesNotExist', CLEAN_FILENAME));
  }
}

export function setFlags(commander: Object) {
  commander.description('Cleans and removes unnecessary files from package dependencies.');
  commander.usage('autoclean [flags]');
  commander.option('-I, --init', `Create "${CLEAN_FILENAME}" file with the default entries.`);
  commander.option('-F, --force', `Run autoclean using the existing "${CLEAN_FILENAME}" file.`);
}

export function hasWrapper(commander: Object): boolean {
  return true;
}
