/**
 * @flow
 */

const crypto = require('crypto');
const path = require('path');
const outdent = require('outdent');
const resolveBase = require('resolve');
const {mapObject} = require('./Utility');
import * as fs from '../util/fs';

function resolve(packageName, baseDirectory, topLevelDir): Promise<string> {
  return new Promise((resolve, reject) => {
    // If we don't pass paths:[..] which includes the topLevelDir,
    // then module resolution won't work when symlinking to a dependency
    // which hasn't been installed yet. I'm not sure why symlinks are any
    // different than _resolved modules - perhaps () resolve treats them
    // differently?l
    resolveBase(packageName, {basedir: baseDirectory, paths:[topLevelDir]}, (err, resolution) => {
      if (err) {
        reject(err);
      } else {
        resolve(resolution);
      }
    });
  });
}

/**
 * Represents sandbox state.
 *
 * Sandbox declaration:
 *
 *    {
 *      env: env,
 *      packageInfo: packageInfo
 *    }
 *
 * Environment override:
 *
 *    {
 *      env: env {
 *        esy__target_architecture: 'arm'
 *      },
 *      packageInfo: packageInfo
 *    }
 *
 */
export type Sandbox = {
  env: Environment;
  looseEnv: Environment;
  packageInfo: PackageInfo;
};

/**
 * Sandbox build environment is a set of k-v pairs.
 */
export type Environment = {[name: string]: string};

export type PackageInfo = {
  source: string;
  sourceType: 'remote' | 'local',
  normalizedName: string;
  rootDirectory: string;
  packageJson: PackageJson;
  dependencyTree: DependencyTree;
  errors: Array<{message: string}>;

  __cachedPackageHash?: string;
};

export type PackageJsonVersionSpec = {
  [name: string]: string;
};

export type EnvironmentVarExport = {
  val: string;
  scope?: string;
  exclusive?: boolean;
  __BUILT_IN_DO_NOT_USE_OR_YOU_WILL_BE_PIPd?: boolean;
};

export type EsyConfig = {
  build: ?string;
  buildsInSource: boolean;
  exportedEnv: {
    [name: string]: EnvironmentVarExport;
  }
};

export type PackageJson = {
  name: string;
  version?: string;
  dependencies?: PackageJsonVersionSpec;
  peerDependencies?: PackageJsonVersionSpec;
  devDependencies?: PackageJsonVersionSpec;
  optionalDependencies?: PackageJsonVersionSpec;

  // This is specific to npm, make sure we get rid of that if we want to port to
  // other package installers.
  //
  // npm puts a resolved name there, for example for packages installed from
  // github — it would be a URL to git repo and a sha1 hash of the tree.
  _resolved?: string;

  esy: EsyConfig;
};

export type DependencyTree = {
  [dependencyName: string]: PackageInfo;
};


type SandboxBuildContext = {
  packageDependencyTrace: Array<string>;
  buildPackageInfo: (string, SandboxBuildContext) => Promise<PackageInfo>;
  resolve: (string, string) => Promise<string>;
};

async function fromDirectory(directory: string): Promise<Sandbox> {
  const source = path.resolve(directory);
  const env = getEnvironment();
  const looseEnv = {...env};
  delete looseEnv.PATH;
  delete looseEnv.SHELL;
  const packageJson = await readPackageJson(path.join(directory, 'package.json'));
  const depSpecList = objectToDependencySpecList(
    packageJson.dependencies,
    packageJson.peerDependencies
  );

  if (depSpecList.length > 0) {

    const resolveCache: Map<string, Promise<string>> = new Map();

    async function resolveWithCache(packageName, baseDir): Promise<string> {
      let key = `${baseDir}__${packageName}`;
      let resolution = resolveCache.get(key);
      if (resolution == null) {
        resolution = await resolve(packageName, baseDir, path.join(directory, 'node_modules'));
        resolveCache.set(key, resolution);
      }
      return resolution;
    }

    const packageInfoCache: Map<string, Promise<PackageInfo>> = new Map();

    async function buildPackageInfoWithCache(baseDirectory, context): Promise<PackageInfo> {
      let packageInfo = packageInfoCache.get(baseDirectory);
      if (packageInfo == null) {
        packageInfo = buildPackageInfo(baseDirectory, context);
        packageInfoCache.set(baseDirectory, packageInfo);
      }
      return packageInfo;
    }

    const [dependencyTree, errors] = await buildDependencyTree(
      source,
      depSpecList,
      {
        resolve: resolveWithCache,
        buildPackageInfo: buildPackageInfoWithCache,
        packageDependencyTrace: [packageJson.name],
      }
    );

    return {
      env,
      looseEnv,
      packageInfo: {
        source: `local:${await fs.realpath(source)}`,
        sourceType: 'local',
        normalizedName: normalizeName(packageJson.name),
        rootDirectory: source,
        packageJson,
        dependencyTree,
        errors,
      }
    };
  } else {
    return {
      env,
      looseEnv,
      packageInfo: {
        source: `local:${await fs.realpath(source)}`,
        sourceType: 'local',
        normalizedName: normalizeName(packageJson.name),
        rootDirectory: source,
        packageJson,
        dependencyTree: {},
        errors: [],
      }
    };
  }
}

/**
 * Traverse package dependency tree.
 */
function traversePackageDependencyTree(
  packageInfo: PackageInfo,
  handler: (packageInfo: PackageInfo) => *
): void {
  let seen = new Set();
  traversePackageDependencyTreeImpl(
    packageInfo,
    seen,
    handler
  );
}

function traversePackageDependencyTreeImpl(
  packageInfo,
  seen,
  handler
) {
  let {dependencyTree} = packageInfo;
  for (let dependencyName in dependencyTree) {
    if (seen.has(dependencyName)) {
      continue;
    }
    seen.add(dependencyName);
    traversePackageDependencyTreeImpl(
      dependencyTree[dependencyName],
      seen,
      handler
    );
  }
  handler(packageInfo)
}

function collectTransitiveDependencies(
  packageInfo: PackageInfo,
  seen: Set<string> = new Set()
): Array<PackageInfo> {
  let packageJson = packageInfo.packageJson;
  let dependencies = Object.keys(packageInfo.dependencyTree);
  let result = [];
  for (let depName of dependencies) {
    let dep = packageInfo.dependencyTree[depName];
    if (seen.has(depName)) {
      continue;
    }
    seen.add(depName);
    result.push(dep);
    result = result.concat(collectTransitiveDependencies(dep, seen));
  }
  return result;
}

function getEnvironment() {
  let platform = process.env.ESY__TEST ? 'platform' : process.platform;
  let architecture = process.env.ESY__TEST ? 'architecture' : process.arch;
  return {
    'PATH': '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
    'SHELL': 'env -i /bin/bash --norc --noprofile',

    // platform and architecture of the host machine
    'esy__platform': platform,
    'esy__architecture': architecture,

    // platform and architecture of the target machine, so that we can do cross
    // compilation
    'esy__target_platform': platform,
    'esy__target_architecture': architecture,
  };
}

async function buildDependencyTree(
  baseDir: string,
  dependencySpecList: Array<string>,
  context: SandboxBuildContext
): Promise<[DependencyTree, Array<{message: string}>]> {
  let dependencyTree: {[name: string]: PackageInfo} = {};
  let errors = [];
  let missingPackages = [];

  for (let dependencySpec of dependencySpecList) {
    const {name} = parseDependencySpec(dependencySpec);

    if (context.packageDependencyTrace.indexOf(name) > -1) {
      errors.push({
        message: formatCircularDependenciesError(name, context)
      });
      continue;
    }

    let dependencyPackageJsonPath = '/does/not/exists';
    try {
      dependencyPackageJsonPath = await context.resolve(`${name}/package.json`, baseDir);
    } catch (_err) {
      missingPackages.push(name);
      continue;
    }

    const packageInfo = await context.buildPackageInfo(dependencyPackageJsonPath, context);

    errors = errors.concat(packageInfo.errors);
    dependencyTree[name] = packageInfo;
  }

  if (missingPackages.length > 0) {
    errors.push({
      message: formatMissingPackagesError(missingPackages, context)
    });
  }

  return [dependencyTree, errors];
}

async function buildPackageInfo(baseDirectory, context) {
  const dependencyBaseDir = path.dirname(baseDirectory);
  const packageJson = await readPackageJson(baseDirectory);
  const [packageDependencyTree, packageErrors] = await buildDependencyTree(
    dependencyBaseDir,
    objectToDependencySpecList(
      packageJson.dependencies,
      packageJson.peerDependencies
    ),
    {
      ...context,
      packageDependencyTrace: context.packageDependencyTrace.concat(packageJson.name),
    }
  );
  const isLocalModule =
    !packageJson._resolved ||
    (packageJson._resolved.indexOf &&
    packageJson._resolved.indexOf('file:') === 0);
  return {
    errors: packageErrors,
    version: packageJson.version,
    /**
     * TODO: Need to consider _resolved file: as also being local. They could
     * have also been edited since last time installed, or reinstalled.
     * Perhaps just checksumming the files is sufficient?
     */
    source: !isLocalModule ? packageJson._resolved : `local:${await fs.realpath(dependencyBaseDir)}`,
    sourceType: !isLocalModule ? 'remote' : 'local',
    rootDirectory: dependencyBaseDir,
    packageJson,
    normalizedName: normalizeName(packageJson.name),
    dependencyTree: packageDependencyTree,
  };
}

function formatMissingPackagesError(missingPackages, context) {
  let packagesToReport = missingPackages.slice(0, 3);
  let packagesMessage = packagesToReport.map(p => `"${p}"`).join(', ');
  let extraPackagesMessage = missingPackages.length > packagesToReport.length ? ` (and ${missingPackages.length - packagesToReport.length} more)` : '';
  let problemPackage = context.packageDependencyTrace[context.packageDependencyTrace.length - 1] || 'NotFound';
  let traceMsg =
    context.packageDependencyTrace.length > 1 ?
    `Package ${problemPackage} is depended on by "${context.packageDependencyTrace.join('" -> "')}"` :
    '';
  return outdent`
    The following dependencies of package "${problemPackage}" could not be resolved correctly:

      ${packagesMessage}${extraPackagesMessage} packages

    ${traceMsg}
    Did you forget to run "esy install" command?
  `;
}

function formatCircularDependenciesError(dependency, context) {
  return outdent`
    Circular dependency "${dependency} detected
      At ${context.packageDependencyTrace.join(' -> ')}
  `
}


async function readJson(filename) {
  const data = await fs.readFile(filename, 'utf8');
  return JSON.parse(data);
}

async function readPackageJson(filename): Promise<PackageJson> {
  const packageJson = await readJson(filename);
  if (packageJson.esy == null) {
    packageJson.esy = {
      build: null,
      exportedEnv: {},
      buildsInSource: false,
      __noEsyConfigPresent: true
    };
  }
  if (packageJson.esy.build == null) {
    packageJson.esy.build = null;
  }
  if (packageJson.esy.exportedEnv == null) {
    packageJson.esy.exportedEnv = {};
  }
  if (packageJson.esy.buildsInSource == null) {
    packageJson.esy.buildsInSource = false;
  }
  return packageJson;
}

function parseDependencySpec(spec: string): {name: string; versionSpec: string} {
  if (spec.startsWith('@')) {
    let [_, name, versionSpec] = spec.split('@', 3);
    return {name: '@' + name, versionSpec};
  } else {
    let [name, versionSpec] = spec.split('@');
    return {name, versionSpec};
  }
}

function objectToDependencySpecList(...objs) {
  let dependencySpecList = [];
  for (let obj of objs) {
    if (obj == null) {
      continue;
    }
    for (let name in obj) {
      let versionSpec = obj[name];
      let dependencySpec = `${name}@${versionSpec}`;
      if (dependencySpecList.indexOf(dependencySpec) === -1) {
        dependencySpecList.push(dependencySpec);
      }
    }
  }
  return dependencySpecList;
}

/**
 * See https://github.com/reasonml/esy/issues/3
 *
 * This scheme:
 *  - does not use - (hyphen) for normalized names.
 *  - does not use __ for normalized names (double under is reserved for our
 *    own suffixes in esy).
 *
 *
 * Details:
 *
 *   .                    __dot__
 *   /                    __slash__
 *    - (hyphen)          _ (under)
 *    _ (under)           ___ (triple under)
 *    __ (double under)   ____ (quadruple)
 */
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/@/g, '')
    .replace(/_+/g, (matched, arg2, arg3) => {
      return matched + '__';
    })
    .replace(/\//g, '__slash__')
    // Add two underscores to every group we see.
    .replace(/\./g, '__dot__')
    .replace(/\-/g, '_');
}

function packageInfoKey(env: Environment, packageInfo: PackageInfo) {
  let {packageJson: {name, version, esy}, normalizedName, source} = packageInfo;
  if (packageInfo.__cachedPackageHash == null) {
    let h = hash({
      env,
      source,
      packageInfo: {
        packageJson: {
          name, version, esy
        },
        dependencyTree: mapObject(packageInfo.dependencyTree, (dep: PackageInfo) =>
          packageInfoKey(env, dep)),
      },
    });
    if (process.env.ESY__TEST) {
      packageInfo.__cachedPackageHash = `${normalizedName}-${version || '0.0.0'}`;
    } else {
      packageInfo.__cachedPackageHash = `${normalizedName}-${version || '0.0.0'}-${h}`;
    }
  }
  return packageInfo.__cachedPackageHash;
}

function hash(value: mixed) {
  if (typeof value === 'object') {
    if (value === null) {
      return hash("null");
    } else if (!Array.isArray(value)) {
      const v = value;
      let keys = Object.keys(v);
      keys.sort();
      return hash(keys.map(k => [k, v[k]]));
    } else {
      return hash(JSON.stringify(value.map(hash)));
    }
  } else if (value === undefined) {
    return hash('undefined');
  } else {
    let hasher = crypto.createHash('sha1');
    hasher.update(JSON.stringify(value));
    return hasher.digest('hex');
  }
}

module.exports = {
  fromDirectory,
  traversePackageDependencyTree,
  collectTransitiveDependencies,
  packageInfoKey,
};
