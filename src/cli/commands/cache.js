/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import buildSubCommands from './_build-sub-commands.js';
import * as fs from '../../util/fs.js';

const invariant = require('invariant');
const path = require('path');
const micromatch = require('micromatch');

export function hasWrapper(flags: Object, args: Array<string>): boolean {
  return args[0] !== 'dir';
}

export async function getCachedPackagesDirs(config: Config, currentPath: string): Object {
  const results = [];
  const stat = await fs.lstat(currentPath);

  if (!stat.isDirectory()) {
    return results;
  }

  const folders = await fs.readdir(currentPath);
  for (const folder of folders) {
    if (folder[0] === '.') {
      continue;
    }
    const packageParentPath = path.join(currentPath, folder, 'node_modules');

    const candidates = await fs.readdir(packageParentPath);
    invariant(
      candidates.length === 1,
      `There should only be one folder in a package cache (got ${candidates.join(',')} in ${packageParentPath})`,
    );

    for (const candidate of candidates) {
      const candidatePath = path.join(packageParentPath, candidate);
      if (candidate.charAt(0) === '@') {
        const subCandidates = await fs.readdir(candidatePath);
        invariant(
          subCandidates.length === 1,
          `There should only be one folder in a package cache (got ${subCandidates.join(',')} in ${candidatePath})`,
        );

        for (const subCandidate of subCandidates) {
          const subCandidatePath = path.join(candidatePath, subCandidate);
          results.push(subCandidatePath);
        }
      } else {
        results.push(candidatePath);
      }
    }
  }

  return results;
}

function _getMetadataWithPath(getMetadataFn: Function, paths: Array<String>): Promise<Array<Object>> {
  return Promise.all(
    paths.map(path =>
      getMetadataFn(path)
        .then(r => {
          r._path = path;
          return r;
        })
        .catch(error => undefined),
    ),
  );
}

async function getCachedPackages(config): Object {
  const paths = await getCachedPackagesDirs(config, config.cacheFolder);
  return _getMetadataWithPath(config.readPackageMetadata.bind(config), paths).then(packages =>
    packages.filter(p => !!p),
  );
}

async function list(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const filterOut = ({registry, package: manifest, remote} = {}) => {
    if (flags.pattern && !micromatch.contains(manifest.name, flags.pattern)) {
      return false;
    }
    return true;
  };

  const forReport = ({registry, package: manifest, remote} = {}) => [
    manifest.name,
    manifest.version,
    registry,
    (remote && remote.resolved) || '',
  ];

  const packages = await getCachedPackages(config);
  const body = packages.filter(filterOut).map(forReport);
  reporter.table(['Name', 'Version', 'Registry', 'Resolved'], body);
}

async function clean(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  if (config.cacheFolder) {
    const activity = reporter.activity();

    if (args.length > 0) {
      // Clear named packages from cache
      const packages = await getCachedPackages(config);
      const shouldDelete = ({registry, package: manifest, remote} = {}) => args.indexOf(manifest.name) !== -1;
      const packagesToDelete = packages.filter(shouldDelete);

      for (const manifest of packagesToDelete) {
        let relativePath = path.relative(config.cacheFolder, manifest._path);
        while (relativePath && relativePath !== '.') {
          await fs.unlink(path.resolve(config.cacheFolder, relativePath));
          relativePath = path.dirname(relativePath);
        }
      }

      activity.end();
      reporter.success(reporter.lang('clearedPackageFromCache', args[0]));
    } else {
      // Clear all cache
      await fs.unlink(config._cacheRootFolder);
      await fs.mkdirp(config.cacheFolder);
      activity.end();
      reporter.success(reporter.lang('clearedCache'));
    }
  }
}

const {run, setFlags: _setFlags, examples} = buildSubCommands('cache', {
  async ls(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    reporter.warn(`\`yarn cache ls\` is deprecated. Please use \`yarn cache list\`.`);
    await list(config, reporter, flags, args);
  },
  list,
  clean,
  dir(config: Config, reporter: Reporter) {
    reporter.log(config.cacheFolder, {force: true});
  },
});

export {run, examples};

export function setFlags(commander: Object) {
  _setFlags(commander);
  commander.description('Yarn cache list will print out every cached package.');
  commander.option('--pattern [pattern]', 'filter cached packages by pattern');
}
