/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import buildSubCommands from './_build-sub-commands.js';
import * as fs from '../../util/fs.js';

const path = require('path');
const micromatch = require('micromatch');

export function hasWrapper(flags: Object, args: Array<string>): boolean {
  return args[0] !== 'dir';
}

function isScopedPackageDirectory(packagePath): boolean {
  return packagePath.indexOf('@') > -1;
}

async function getPackagesPaths(config, currentPath): Object {
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
    const packagePath = path.join(currentPath, folder);
    if (isScopedPackageDirectory(folder)) {
      results.push(...(await getPackagesPaths(config, packagePath)));
    } else {
      results.push(packagePath);
    }
  }
  return results;
}

async function getCachedPackages(config): Object {
  const paths = await getPackagesPaths(config, config.cacheFolder);
  return Promise.all(paths.map(config.readPackageMetadata.bind(config)));
}

async function list(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const filterOut = ({registry, package: manifest, remote}) => {
    if (flags.pattern && !micromatch.contains(manifest.name, flags.pattern)) {
      return false;
    }
    return true;
  };

  const forReport = ({registry, package: manifest, remote}) => [
    manifest.name,
    manifest.version,
    registry,
    (remote && remote.resolved) || '',
  ];

  const packages = await getCachedPackages(config);
  const body = packages.filter(filterOut).map(forReport);
  reporter.table(['Name', 'Version', 'Registry', 'Resolved'], body);
}

const {run, setFlags: _setFlags, examples} = buildSubCommands('cache', {
  async ls(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    reporter.warn(`\`yarn cache ls\` is deprecated. Please use \`yarn cache list\`.`);
    await list(config, reporter, flags, args);
  },

  list,

  dir(config: Config, reporter: Reporter) {
    reporter.log(config.cacheFolder, {force: true});
  },

  async clean(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    if (config.cacheFolder) {
      const activity = reporter.activity();

      if (args.length > 0) {
        // Clear named package from cache
        const paths = await getPackagesPaths(config, config.cacheFolder);

        const deletePaths = [];
        for (const packagePath of paths) {
          const {package: manifest} = await config.readPackageMetadata(packagePath);
          if (args[0] === manifest.name) {
            deletePaths.push(packagePath);
          }
        }

        if (deletePaths.length === 0) {
          activity.end();
          reporter.warn(reporter.lang('couldntClearPackageFromCache', args[0]));
          return;
        }

        for (const folder of deletePaths) {
          await fs.unlink(folder);
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
  },
});

export {run, examples};

export function setFlags(commander: Object) {
  _setFlags(commander);
  commander.description('Yarn cache list will print out every cached package.');
  commander.option('--pattern [pattern]', 'filter cached packages by pattern');
}
