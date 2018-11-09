// @flow

import type Config from '../config.js';
import type WorkspaceLayout from '../workspace-layout.js';
import type PackageResolver from '../package-resolver.js';
import type Reporter from '../reporters/base-reporter.js';
import pnpApi from './generate-pnp-map-api.tpl.js';
import * as fs from './fs.js';

const crypto = require('crypto');
const invariant = require('invariant');
const path = require('path');

const backwardSlashRegExp = /\\/g;

const OFFLINE_CACHE_EXTENSION = `.zip`;

type PackageInformation = {|
  packageLocation: string,
  packageDependencies: Map<string, string>,
|};

type PackageInformationStore = Map<string | null, PackageInformation>;
type PackageInformationStores = Map<string | null, PackageInformationStore>;

type GeneratePnpMapOptions = {|
  resolver: PackageResolver,
  reporter: Reporter,
  targetPath: string,
  workspaceLayout: ?WorkspaceLayout,
|};

function generateMaps(packageInformationStores: PackageInformationStores, blacklistedLocations: Set<string>): string {
  let code = ``;

  // Bake the information stores into our generated code
  code += `let packageInformationStores = new Map([\n`;
  for (const [packageName, packageInformationStore] of packageInformationStores) {
    code += `  [${JSON.stringify(packageName)}, new Map([\n`;
    for (const [packageReference, {packageLocation, packageDependencies}] of packageInformationStore) {
      code += `    [${JSON.stringify(packageReference)}, {\n`;
      code += `      packageLocation: path.resolve(__dirname, ${JSON.stringify(packageLocation)}),\n`;
      code += `      packageDependencies: new Map([\n`;
      for (const [dependencyName, dependencyReference] of packageDependencies.entries()) {
        code += `        [${JSON.stringify(dependencyName)}, ${JSON.stringify(dependencyReference)}],\n`;
      }
      code += `      ]),\n`;
      code += `    }],\n`;
    }
    code += `  ])],\n`;
  }
  code += `]);\n`;

  code += `\n`;

  // Also bake an inverse map that will allow us to find the package information based on the path
  code += `let locatorsByLocations = new Map([\n`;
  for (const blacklistedLocation of blacklistedLocations) {
    code += `  [${JSON.stringify(blacklistedLocation)}, blacklistedLocator],\n`;
  }
  for (const [packageName, packageInformationStore] of packageInformationStores) {
    for (const [packageReference, {packageLocation}] of packageInformationStore) {
      if (packageName !== null) {
        code += `  [${JSON.stringify(packageLocation)}, ${JSON.stringify({
          name: packageName,
          reference: packageReference,
        })}],\n`;
      } else {
        code += `  [${JSON.stringify(packageLocation)}, topLevelLocator],\n`;
      }
    }
  }
  code += `]);\n`;

  return code;
}

function generateFindPackageLocator(packageInformationStores: PackageInformationStores): string {
  let code = ``;

  // We get the list of each string length we'll need to check in order to find the current package context
  const lengths = new Map();

  for (const packageInformationStore of packageInformationStores.values()) {
    for (const {packageLocation} of packageInformationStore.values()) {
      if (packageLocation === null) {
        continue;
      }

      const length = packageLocation.length;
      const count = (lengths.get(length) || 0) + 1;

      lengths.set(length, count);
    }
  }

  // We must try the larger lengths before the smaller ones, because smaller ones might also match the longest ones
  // (for instance, /project/path will match /project/path/.pnp/global/node_modules/pnp-cf5f9c17b8f8db)
  const sortedLengths = Array.from(lengths.entries()).sort((a, b) => {
    return b[0] - a[0];
  });

  // Generate a function that, given a file path, returns the associated package name
  code += `exports.findPackageLocator = function findPackageLocator(location) {\n`;
  code += `  let relativeLocation = normalizePath(path.relative(__dirname, location));\n`;
  code += `\n`;
  code += `  if (!relativeLocation.match(isStrictRegExp))\n`;
  code += `    relativeLocation = \`./\${relativeLocation}\`;\n`;
  code += `\n`;
  code += `  if (location.match(isDirRegExp) && relativeLocation.charAt(relativeLocation.length - 1) !== '/')\n`;
  code += `    relativeLocation = \`\${relativeLocation}/\`;\n`;
  code += `\n`;
  code += `  let match;\n`;

  for (const [length] of sortedLengths) {
    code += `\n`;
    code += `  if (relativeLocation.length >= ${length} && relativeLocation[${length - 1}] === '/')\n`;
    code += `    if (match = locatorsByLocations.get(relativeLocation.substr(0, ${length})))\n`;
    code += `      return blacklistCheck(match);\n`;
  }

  code += `\n`;
  code += `  return null;\n`;
  code += `};\n`;

  return code;
}

async function getPackageInformationStores(
  config: Config,
  seedPatterns: Array<string>,
  {resolver, reporter, targetPath, workspaceLayout}: GeneratePnpMapOptions,
): Promise<[PackageInformationStores, Set<string>]> {
  const targetDirectory = path.dirname(targetPath);
  const offlineCacheFolder = config.offlineCacheFolder;

  const packageInformationStores: PackageInformationStores = new Map();
  const blacklistedLocations: Set<string> = new Set();

  const getCachePath = (fsPath: string) => {
    const cacheRelativePath = normalizePath(path.relative(config.cacheFolder, fsPath));

    // if fsPath is not inside cacheRelativePath, we just skip it
    if (cacheRelativePath.match(/^\.\.\//)) {
      return null;
    }

    return cacheRelativePath;
  };

  const resolveOfflineCacheFolder = (fsPath: string) => {
    if (!offlineCacheFolder) {
      return fsPath;
    }

    const cacheRelativePath = getCachePath(fsPath);

    // if fsPath is not inside the cache, we shouldn't replace it (workspace)
    if (!cacheRelativePath) {
      return fsPath;
    }

    const components = cacheRelativePath.split(/\//g);
    const [cacheEntry, ...internalPath] = components;

    return path.resolve(offlineCacheFolder, `${cacheEntry}${OFFLINE_CACHE_EXTENSION}`, internalPath.join('/'));
  };

  const normalizePath = (fsPath: string) => {
    return process.platform === 'win32' ? fsPath.replace(backwardSlashRegExp, '/') : fsPath;
  };

  const normalizeDirectoryPath = (fsPath: string) => {
    let relativePath = normalizePath(path.relative(targetDirectory, resolveOfflineCacheFolder(fsPath)));

    if (!relativePath.match(/^\.{0,2}\//) && !path.isAbsolute(relativePath)) {
      relativePath = `./${relativePath}`;
    }

    return relativePath.replace(/\/?$/, '/');
  };

  const getHashFrom = (data: Array<string>) => {
    const hashGenerator = crypto.createHash('sha1');

    for (const datum of data) {
      hashGenerator.update(datum);
    }

    return hashGenerator.digest('hex');
  };

  const getResolverEntry = pattern => {
    const pkg = resolver.getStrictResolvedPattern(pattern);
    const ref = pkg._reference;

    if (!ref) {
      return null;
    }

    invariant(ref.locations.length <= 1, 'Must have at most one location (usually in the cache)');
    const loc = ref.locations[0];

    if (!loc) {
      return null;
    }

    return {pkg, ref, loc};
  };

  const visit = async (
    precomputedResolutions: Map<string, string>,
    seedPatterns: Array<string>,
    parentData: Array<string> = [],
  ) => {
    const resolutions = new Map(precomputedResolutions);
    const locations = new Map();

    // This first pass will compute the package reference of each of the given patterns
    // They will usually be the package version, but not always. We need to do this in a pre-process pass, because the
    // dependencies might depend on one another, so if we need to replace one of them, we need to compute it first
    for (const pattern of seedPatterns) {
      const entry = getResolverEntry(pattern);

      if (!entry) {
        continue;
      }

      const {pkg, ref} = entry;
      let {loc} = entry;

      const packageName = pkg.name;
      let packageReference = pkg.version;

      // If we have peer dependencies, then we generate a new virtual reference based on the parent one
      // We cannot generate this reference based on what those peer references resolve to, because they might not have
      // been computed yet (for example, consider the case where A has a peer dependency on B, and B a peer dependency
      // on A; it's valid, but it prevents us from computing A and B - and it's even worse with 3+ packages involved)
      const peerDependencies = new Set(Array.from(Object.keys(pkg.peerDependencies || {})));

      // As an optimization, we only setup virtual packages if their underlying packages are referenced multiple times
      // in the tree. This allow us to avoid having to create symlinks in the majority of cases
      if (peerDependencies.size > 0 && ref.requests.length > 1) {
        const hash = getHashFrom([...parentData, packageName, packageReference]);

        let symlinkSource;
        let symlinkFile;

        switch (ref.remote.type) {
          case 'workspace':
            {
              symlinkSource = loc;
              symlinkFile = path.resolve(config.lockfileFolder, '.pnp', 'workspaces', `pnp-${hash}`, packageName);

              loc = symlinkFile;
            }
            break;

          default:
            {
              const isFromCache = getCachePath(loc);

              const hashName =
                isFromCache && offlineCacheFolder ? `pnp-${hash}${OFFLINE_CACHE_EXTENSION}` : `pnp-${hash}`;
              const newLoc = path.resolve(
                config.lockfileFolder,
                '.pnp',
                'externals',
                hashName,
                'node_modules',
                packageName,
              );

              // The `node_modules/<pkgName>` part is already there when the package comes from the cache
              if (isFromCache) {
                const getBase = source => path.resolve(source, '../'.repeat(1 + packageName.split('/').length));
                symlinkSource = resolveOfflineCacheFolder(getBase(loc));
                symlinkFile = getBase(newLoc);
              } else {
                symlinkSource = loc;
                symlinkFile = newLoc;
              }

              loc = newLoc;
            }
            break;
        }

        await fs.mkdirp(path.dirname(symlinkFile));
        await fs.symlink(symlinkSource, symlinkFile);

        packageReference = `pnp:${hash}`;

        // We blacklist this path so that we can print a nicer error message if someone tries to require it (it usually
        // means that they're using realpath on the return value of require.resolve)
        blacklistedLocations.add(normalizeDirectoryPath(loc));
      }

      // Now that we have the final reference, we need to store it
      resolutions.set(packageName, packageReference);
      locations.set(packageName, loc);
    }

    // Now that we have the final references, we can start the main loop, which will insert the packages into the store
    // if they aren't already there, and recurse over their own children
    for (const pattern of seedPatterns) {
      const entry = getResolverEntry(pattern);

      if (!entry) {
        continue;
      }

      const {pkg, ref} = entry;

      const packageName = pkg.name;

      const packageReference = resolutions.get(packageName);
      invariant(packageReference, `Package reference should have been computed during the pre-pass`);

      const loc = locations.get(packageName);
      invariant(loc, `Package location should have been computed during the pre-pass`);

      // We can early exit if the package is already registered with the exact same name and reference, since even if
      // we might get slightly different dependencies (depending on how things were optimized), both sets are valid
      let packageInformationStore = packageInformationStores.get(packageName);

      if (!packageInformationStore) {
        packageInformationStore = new Map();
        packageInformationStores.set(packageName, packageInformationStore);
      }

      let packageInformation = packageInformationStore.get(packageReference);

      if (packageInformation) {
        continue;
      }

      packageInformation = {
        packageLocation: normalizeDirectoryPath(loc),
        packageDependencies: new Map(),
      };

      // Split the dependencies between direct/peer - we will only recurse on the former
      const peerDependencies = new Set(Array.from(Object.keys(pkg.peerDependencies || {})));
      const directDependencies = ref.dependencies.filter(pattern => {
        const pkg = resolver.getStrictResolvedPattern(pattern);
        return !pkg || !peerDependencies.has(pkg.name);
      });

      // We inject the partial information in the store right now so that we won't cycle indefinitely
      packageInformationStore.set(packageReference, packageInformation);

      // We must inject the peer dependencies before iterating; one of our dependencies might have a peer dependency
      // on one of our peer dependencies, so it must be available from the start (we don't have to do that for direct
      // dependencies, because the "visit" function that will iterate over them will automatically add the to the
      // candidate resolutions as part of the first step, cf above)

      for (const dependencyName of peerDependencies) {
        const dependencyReference = resolutions.get(dependencyName);

        if (dependencyReference) {
          packageInformation.packageDependencies.set(dependencyName, dependencyReference);
        }
      }

      const childResolutions = await visit(packageInformation.packageDependencies, directDependencies, [
        packageName,
        packageReference,
      ]);

      // We can now inject into our package the resolutions we got from the visit function
      for (const [name, reference] of childResolutions.entries()) {
        packageInformation.packageDependencies.set(name, reference);
      }

      // Finally, unless a package depends on a previous version of itself (that would be weird but correct...), we
      // inject them an implicit dependency to themselves (so that they can require themselves)
      if (!packageInformation.packageDependencies.has(packageName)) {
        packageInformation.packageDependencies.set(packageName, packageReference);
      }
    }

    return resolutions;
  };

  // If we have workspaces, we need to iterate over them all in order to add them to the map
  // This is because they might not be declared as dependencies of the top-level project (and with reason, since the
  // top-level package might depend on a different than the one provided in the workspaces - cf Babel, which depends
  // on an old version of itself in order to compile itself)
  if (workspaceLayout) {
    for (const name of Object.keys(workspaceLayout.workspaces)) {
      const pkg = workspaceLayout.workspaces[name].manifest;

      // Skip the aggregator, since it's essentially a duplicate of the top-level package that we'll iterate later on
      if (pkg.workspaces) {
        continue;
      }

      const ref = pkg._reference;
      invariant(ref, `Workspaces should have a reference`);

      invariant(ref.locations.length === 1, `Workspaces should have exactly one location`);
      const loc = ref.locations[0];
      invariant(loc, `Workspaces should have a location`);

      let packageInformationStore = packageInformationStores.get(name);

      if (!packageInformationStore) {
        packageInformationStore = new Map();
        packageInformationStores.set(name, packageInformationStore);
      }

      packageInformationStore.set(pkg.version, {
        packageLocation: normalizeDirectoryPath(loc),
        packageDependencies: await visit(new Map(), ref.dependencies, [name, pkg.version]),
      });
    }
  }

  // Register the top-level package in our map
  // This will recurse on each of its dependencies as well.
  packageInformationStores.set(
    null,
    new Map([
      [
        null,
        {
          packageLocation: normalizeDirectoryPath(config.lockfileFolder),
          packageDependencies: await visit(new Map(), seedPatterns),
        },
      ],
    ]),
  );

  return [packageInformationStores, blacklistedLocations];
}

export async function generatePnpMap(
  config: Config,
  seedPatterns: Array<string>,
  {resolver, reporter, workspaceLayout, targetPath}: GeneratePnpMapOptions,
): Promise<string> {
  const [packageInformationStores, blacklistedLocations] = await getPackageInformationStores(config, seedPatterns, {
    resolver,
    reporter,
    targetPath,
    workspaceLayout,
  });

  const setupStaticTables = [
    generateMaps(packageInformationStores, blacklistedLocations),
    generateFindPackageLocator(packageInformationStores),
  ].join(``);

  return pnpApi
    .replace(/\$\$SHEBANG/g, config.plugnplayShebang)
    .replace(/\$\$BLACKLIST/g, JSON.stringify(config.plugnplayBlacklist))
    .replace(/\$\$SETUP_STATIC_TABLES\(\);/g, setupStaticTables);
}
