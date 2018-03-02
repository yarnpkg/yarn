// @flow

import type Config from '../config.js';
import type PackageResolver from '../package-resolver.js';
import * as fs from './fs.js';

const path = require('path');

type PackageInformation = {|packageLocation: string, packageDependencies: Map<string, string>|};
type PackageInformationStore = Map<string | null, PackageInformation>;
type PackageInformationStores = Map<string | null, PackageInformationStore>;

function generateMaps(packageInformationStores: PackageInformationStores): string {
  let code = ``;

  // Bake the information stores into our generated code
  code += `let packageInformationStores = new Map([\n`;

  for (const [packageName, packageInformationStore] of packageInformationStores) {
    code += `    [ ${JSON.stringify(packageName)}, new Map([\n`;

    for (const [packageReference, {packageLocation, packageDependencies}] of packageInformationStore) {
      code += `        [ ${JSON.stringify(packageReference)}, {\n`;
      code += `            packageLocation: ${JSON.stringify(packageLocation)},\n`;
      code += `            packageDependencies: new Map([\n`;

      for (const [dependencyName, dependencyReference] of packageDependencies.entries()) {
        code += `                [ ${JSON.stringify(dependencyName)}, ${JSON.stringify(dependencyReference)} ],\n`;
      }

      code += `            ]),\n`;
      code += `        } ],\n`;
    }

    code += `    ]) ],\n`;
  }

  code += `]);\n`;

  // Also bake an inverse map that will allow us to find the package information based on the path
  code += `let locatorsByLocations = new Map([\n`;

  for (const [packageName, packageInformationStore] of packageInformationStores) {
    for (const [packageReference, {packageLocation}] of packageInformationStore) {
      code += `    [ ${JSON.stringify(packageLocation)}, ${JSON.stringify({
        name: packageName,
        reference: packageReference,
      })} ],\n`;
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
      if (packageLocation !== null) {
        lengths.set(packageLocation.length, (lengths.get(packageLocation.length) || 0) + 1);
      }
    }
  }

  // We sort the lengths by the number of time they are used, so that the more common ones are tested before the others
  const sortedLengths = Array.from(lengths.entries()).sort((a, b) => {
    return b[1] - a[1];
  });

  // Generate a function that, given a file path, returns the associated package name
  code += `exports.findPackageLocator = function findPackageLocator(location) {\n`;
  code += `\n`;
  code += `    let match;\n`;

  for (const [length] of sortedLengths) {
    code += `\n`;
    code += `    if (location.length >= ${length} && location[${length} - 1] === path.sep)\n`;
    code += `        if (match = locatorsByLocations.get(location.substr(0, ${length})))\n`;
    code += `            return match;\n`;
  }

  code += `\n`;
  code += `    return null;\n`;
  code += `};\n`;

  return code;
}

function generateGetPackageLocation(packageInformationStores: PackageInformationStores): string {
  let code = ``;

  // Generate a function that, given a locator, returns the package location on the disk

  code += `exports.getPackageLocation = function getPackageLocation({ name, reference }) {\n`;
  code += `\n`;
  code += `    let packageInformationStore, packageInformation;\n`;
  code += `\n`;
  code += `    if (packageInformationStore = packageInformationStores.get(name))\n`;
  code += `        if (packageInformation = packageInformationStore.get(reference))\n`;
  code += `            return packageInformation.packageLocation;\n`;
  code += `\n`;
  code += `    return null;\n`;
  code += `\n`;
  code += `};\n`;

  return code;
}

function generateGetPackageDependencies(packageInformationStores: PackageInformationStores): string {
  let code = ``;

  // Generate a function that, given a locator, returns the package dependencies

  code += `exports.getPackageDependencies = function getPackageDependencies({ name, reference }) {\n`;
  code += `\n`;
  code += `    let packageInformationStore, packageInformation;\n`;
  code += `\n`;
  code += `    if (packageInformationStore = packageInformationStores.get(name))\n`;
  code += `        if (packageInformation = packageInformationStore.get(reference))\n`;
  code += `            return packageInformation.packageDependencies;\n`;
  code += `\n`;
  code += `    return null;\n`;
  code += `};\n`;

  return code;
}

/* eslint-disable max-len */
const PROLOGUE = `
let path = require('path');
`;
/* eslint-enable max-len */

/* eslint-disable max-len */
const REQUIRE_HOOK = lockfileFolder => `
let Module = require('module');

let originalResolver = Module._resolveFilename;
let pathRegExp = /^(?!\\.{0,2}\\/)([^\\/]+)(\\/.*|)$/;

Module._resolveFilename = function (request, parent, isMain, options) {

    if (Module.builtinModules.includes(request))
        return request;

    let dependencyNameMatch = request.match(pathRegExp);

    if (!dependencyNameMatch)
        return originalResolver.call(Module, request, parent, isMain, options);

    let caller = parent;

    while (caller && (caller.id === '[eval]' || caller.id === '<repl>' || !caller.filename))
        caller = caller.parent;

    let packagePath = caller ? caller.filename : process.cwd() + path.sep;
    let packageLocator = exports.findPackageLocator(packagePath);

    if (!packageLocator)
        throw new Error(\`Could not find to which package belongs the path \${packagePath}\`);

    let [ , dependencyName, subPath ] = dependencyNameMatch;

    let packageDependencies = exports.getPackageDependencies(packageLocator);
    let dependencyReference = packageDependencies.get(dependencyName);

    if (!dependencyReference) {

        if (packageLocator.name === null)
            throw new Error(\`You cannot require a package (\${dependencyName}) that is not declared in your dependencies\`);

        let topLevelDependencies = exports.getPackageDependencies({ name: null, reference: null });
        dependencyReference = topLevelDependencies.get(dependencyName);

        if (!dependencyReference) {
            throw new Error(\`Package \${packageLocator.name}@\${packageLocator.reference} is trying to require package \${dependencyName}, which is not declared in its dependencies (\${Array.from(packageDependencies.keys()).join(\`, \`)})\`);
        }

    }

    let dependencyLocation = exports.getPackageLocation({ name: dependencyName, reference: dependencyReference });

    if (!dependencyLocation)
        throw new Error(\`Package \${dependencyName}@\${dependencyReference} is a valid dependency, but hasn't been installed and thus cannot be required\`);

    return originalResolver.call(Module, \`\${dependencyLocation}/\${subPath}\`, parent, isMain, options);

};
`;
/* eslint-enable */

async function getPackageInformationStores(
  config: Config,
  seedPatterns: Array<string>,
  {resolver}: {resolver: PackageResolver},
): Promise<PackageInformationStores> {
  const packageInformationStores = new Map();

  const pkgs = resolver.getTopologicalManifests(seedPatterns);

  for (const pkg of pkgs) {
    if (pkg._reference && pkg._reference.location && pkg._reference.isPlugnplay) {
      const ref = pkg._reference;
      const loc = pkg._reference.location;

      let packageInformationStore = packageInformationStores.get(pkg.name);

      if (!packageInformationStore) {
        packageInformationStores.set(pkg.name, (packageInformationStore = new Map()));
      }

      const packageDependencies = new Map();

      for (const pattern of ref.dependencies) {
        const dep = resolver.getStrictResolvedPattern(pattern);
        packageDependencies.set(dep.name, dep.version);
      }

      packageInformationStore.set(pkg.version, {
        packageLocation: (await fs.realpath(loc)).replace(/[\\\/]?$/, path.sep),
        packageDependencies,
      });
    }
  }

  // Top-level package
  if (true) {
    const topLevelDependencies = new Map();

    for (const pattern of seedPatterns) {
      const dep = resolver.getStrictResolvedPattern(pattern);
      topLevelDependencies.set(dep.name, dep.version);
    }

    packageInformationStores.set(
      null,
      new Map([
        [
          null,
          {
            packageLocation: (await fs.realpath(config.lockfileFolder)).replace(/[\\\/]?$/, path.sep),
            packageDependencies: topLevelDependencies,
          },
        ],
      ]),
    );
  }

  return packageInformationStores;
}

export async function generatePnpMap(
  config: Config,
  seedPatterns: Array<string>,
  {resolver}: {resolver: PackageResolver},
): Promise<string> {
  const packageInformationStores = await getPackageInformationStores(config, seedPatterns, {resolver});

  let code = PROLOGUE;

  code += generateMaps(packageInformationStores);

  code += generateFindPackageLocator(packageInformationStores);
  code += generateGetPackageLocation(packageInformationStores);
  code += generateGetPackageDependencies(packageInformationStores);

  code += REQUIRE_HOOK(config.lockfileFolder);

  return code;
}
