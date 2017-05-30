import {UsageError} from '@manaflair/concierge';
import detectIndent from 'detect-indent';
import Immutable from 'immutable';
import Path from 'path';
import shellEscape from 'shell-escape';

import {PackageInfo} from 'miniyarn/models/PackageInfo';
import {PackageRange} from 'miniyarn/models/PackageRange';
import {YarnLock} from 'miniyarn/models/YarnLock';
import * as cryptoUtils from 'miniyarn/utils/crypto';
import * as execUtils from 'miniyarn/utils/exec';
import * as fsUtils from 'miniyarn/utils/fs';
import {env} from 'miniyarn/yarn/env';

export async function resolveRcValues(path) {
  let values = {};

  let previous = null;
  let current = Path.normalize(path);

  do {
    let filePath = `${current}/.yarnrc`;

    try {
      if (await fsUtils.exists(filePath)) {
        values = Object.assign(await fsUtils.readJson(filePath), values);
      }
    } catch (error) {
      // Ignore any parsing error
    }

    previous = current;
    current = Path.dirname(current);
  } while (current !== previous);

  return values;
}

export async function findPackagePath(path, {packageFile = `package.json`} = {}) {
  let entries = await fsUtils.readDirectory(path);

  if (entries.includes(packageFile)) return path;

  let parentDirectory = Path.dirname(path);

  if (parentDirectory === path) return null;

  return await findPackagePath(parentDirectory);
}

export async function openPackage(path) {
  let packagePath = await findPackagePath(path);

  if (!packagePath) throw new UsageError(`This command can only be run from within a Yarn project`);

  let packageInfo = new PackageInfo((await fsUtils.readJson(`${packagePath}/package.json`))).merge({reference: null});
  let yarnLock = (await fsUtils.exists(`${packagePath}/yarn.json`))
    ? new YarnLock((await fsUtils.readJson(`${packagePath}/yarn.json`)))
    : null;

  return {packagePath, packageInfo, yarnLock};
}

export async function openEnvironment(path, args) {
  let finalEnv = env;
  let values = await resolveRcValues(path);

  for (let [key, value] of Object.entries(values)) {
    let envKey = key.replace(/([A-Z])(?=[a-z]|$)/g, (_0, _1) => `_${_1}`).toUpperCase();
    finalEnv = finalEnv.has(envKey) ? finalEnv.set(envKey, value) : finalEnv;
  }

  return finalEnv;
}

export function parseIdentifier(identifier) {
  let regex = /^((?:@([a-z0-9][a-z0-9_.-]*)\/)?([a-z0-9][a-z0-9_.-]*))(?:@(.+))?$/i;
  let match = identifier.match(regex);

  if (!match) return null;

  return {name: match[1], scope: match[2], localName: match[3], reference: match[4]};
}

export function parseRangeIdentifiers(identifiers) {
  let invalidPackageIdentifiers = [];
  let packageRanges = [];

  for (let identifier of identifiers) {
    let match = parseIdentifier(identifier);

    if (match) {
      packageRanges.push(new PackageRange({name: match.name, reference: match.reference}));
    } else {
      invalidPackageIdentifiers.push(identifier);
    }
  }

  if (invalidPackageIdentifiers.length > 0)
    throw new UsageError(
      `Invalid package identifier(s): ${invalidPackageIdentifiers.map(identifier => `"${identifier}"`).join(`, `)}`,
    );

  return packageRanges;
}

export function getLocatorIdentifier(packageLocator) {
  let {name = `<unnamed>`, reference = `<unversioned>`} = packageLocator;

  return `${name}@${reference}`;
}

export function getRangeIdentifier(packageRange) {
  let {name = `<unnamed>`, reference = `<unversioned>`} = packageRange;

  return `${name}@${reference}`;
}

export function getLocatorSlugIdentifier(packageLocator) {
  if (!packageLocator.reference) return null;

  let slug = packageLocator.reference.replace(/[^a-zA-Z0-9._-]+/, `-`).replace(/-+/g, `-`).replace(/^-+|-+$/g, ``);

  let hash = cryptoUtils.sha256([packageLocator.reference].join(` `)).slice(0, 16);

  return [slug, hash].join(`-`);
}

export async function runPackageLifecycle(packageInfo, packagePath, lifecycle, {args = [], stdio} = {}) {
  if (!packageInfo.scripts.has(lifecycle)) return;

  let cwd = packagePath;

  let env = Object.assign({}, process.env, {
    PATH: `${packagePath}/node_modules/.bin${Path.delimiter}${process.env.PATH}`,
  });

  let command = [packageInfo.scripts.get(lifecycle), shellEscape(args)].join(` `);

  await execUtils.spawnCommand(command, {cwd, env, stdio});
}

export async function updateYarnJson(packagePath, callback) {
  return await updateMetaFile(`${packagePath}/yarn.json`, async yarnJson => {
    await callback(yarnJson);
  });
}

export async function updatePackageJson(packagePath, callback) {
  return await updateMetaFile(`${packagePath}/package.json`, async packageJson => {
    await callback(packageJson);

    for (let target of [`dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`]) {
      if (!Object.prototype.hasOwnProperty.call(packageJson, target)) continue;

      let keys = Reflect.ownKeys(packageJson[target]).sort((a, b) => {
        return a.localeCompare(b);
      });

      packageJson[target] = keys.reduce((sorted, key) => {
        return Object.assign(sorted, {[key]: packageJson[target][key]});
      }, {});
    }
  });
}

export async function updateMetaFile(filename, callback) {
  let metaFile = {};
  let indent = `    `;

  if (await fsUtils.exists(filename)) {
    let content = await fsUtils.readFile(filename, `utf8`);

    metaFile = JSON.parse(content);
    indent = detectIndent(content).indent || `    `;
  }

  await callback(metaFile);

  return await fsUtils.writeFile(filename, JSON.stringify(metaFile, null, indent) + `\n`);
}

export async function writeAtomicFile(path) {
  await fsUtils.writeFile(path, `"(❛ᴗ❛)"`);
}
