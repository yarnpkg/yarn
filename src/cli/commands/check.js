/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {MessageError} from '../../errors.js';
import {Install} from './install.js';
import Lockfile from '../../lockfile/wrapper.js';
import * as fs from '../../util/fs.js';
import Registry from '../../registries/base-registry.js';

const semver = require('semver');
const path = require('path');

export const requireLockfile = true;
export const noArguments = true;

export function setFlags(commander: Object) {
  commander.option('--integrity');
  commander.option('--commonjs');
}

async function commonJsCheck(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  let warningCount = 0;
  let errCount = 0;
  function reportError(msg, ...vars) {
    reporter.error(reporter.lang(msg, ...vars));
    errCount++;
  }
  // check all dependencies recursively without relying on internal resolver
  const registryName = 'yarn';
  const registry = config.registries[registryName];
  const pkg = await config.readManifest(registry.cwd, registryName);

  type PackageToVerify = {
    name: string,
    originalKey: string,
    parentCwd: string,
    version: string,
  };
  // TODO check devDependencies, optionalDependencies, peerDependencies
  let dependenciesToCheckVersion: PackageToVerify[] =
  Object.keys(pkg.dependencies).map(
    (name) => {
      return {
        name: name,
        originalKey: name,
        parentCwd: registry.cwd,
        version: pkg.dependencies[name],
      }
    }
  );
  let locationsVisited: Set<string> = new Set();
  while(dependenciesToCheckVersion.length) {
    const dep = dependenciesToCheckVersion.shift();
    const manifestLoc = path.join(dep.parentCwd, registry.folder, dep.name);
    if (locationsVisited.has(manifestLoc + `@${dep.version}`)) {
      continue;
    }
    locationsVisited.add(manifestLoc + `@${dep.version}`);
    if (!await fs.exists(manifestLoc)) {
      reportError('packageNotInstalled', `${dep.originalKey}`);
      continue;
    }
    const pkg = await config.readManifest(manifestLoc, registryName);
    if (!semver.satisfies(pkg.version, dep.version, config.looseSemver)) {
      reportError('packageWrongVersion', dep.originalKey, dep.version, pkg.version);
      continue;
    }
    if (pkg.dependencies) {
      for (let subdep in pkg.dependencies) {
        const subDepPath = path.join(manifestLoc, registry.folder, subdep);
        let found = false;
        const relative = path.relative(registry.cwd, subDepPath);
        const locations = path.normalize(relative).split(path.sep).
          filter((dir) => dir !== registry.folder);
        locations.pop();
        while (locations.length >= 0) {
          let possiblePath;
          if (locations.length > 0) {
            possiblePath = path.join(registry.cwd, registry.folder, locations.join(path.sep + registry.folder + path.sep));
          } else {
            possiblePath = registry.cwd;
          }
          if (await fs.exists(path.join(possiblePath, registry.folder, subdep))) {
            dependenciesToCheckVersion.push({
              name: subdep,
              originalKey: `${dep.originalKey}#${subdep}`,
              parentCwd: possiblePath,
              version: pkg.dependencies[subdep],
            });
            found = true;
            break;
          }
          if (!locations.length) {
            break;
          }
          locations.pop();
        }
        if (!found) {
          reportError('packageNotInstalled', `${dep.originalKey}#${subdep}`);
        }
      }
    }
  }

  if (warningCount > 1) {
    reporter.info(reporter.lang('foundWarnings', warningCount));
  }

  if (errCount > 0) {
    throw new MessageError(reporter.lang('foundErrors', errCount));
  } else {
    reporter.success(reporter.lang('folderInSync'));
  }
}


export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  let warningCount = 0;
  let errCount = 0;
  function reportError(msg, ...vars) {
    reporter.error(reporter.lang(msg, ...vars));
    errCount++;
  }
    // TODO move to a separate subcommand
  if (flags.commonjs) {
    return commonJsCheck(config, reporter, flags, args);
  }
  const lockfile = await Lockfile.fromDirectory(config.cwd);
  const install = new Install(flags, config, reporter, lockfile);

  function humaniseLocation(loc: string): Array<string> {
    const relative = path.relative(path.join(config.cwd, 'node_modules'), loc);
    const normalized = path.normalize(relative).split(path.sep);
    return normalized.filter((p) => p !== 'node_modules').reduce((result, part) => {
      const length = result.length;
      if (length && result[length - 1].startsWith('@') && !result[length - 1].includes(path.sep)) {
        result[length - 1] += path.sep + part;
      } else {
        result.push(part);
      }
      return result;
    }, []);
  }


  // get patterns that are installed when running `yarn install`
  const {patterns: rawPatterns} = await install.hydrate(true);
  const patterns = await install.flatten(rawPatterns);

  // check if patterns exist in lockfile
  for (const pattern of patterns) {
    if (!lockfile.getLocked(pattern)) {
      reportError('lockfileNotContainPatter', pattern);
    }
  }

  if (flags.integrity) {
    // just check the integrity hash for validity
    const integrityLoc = await install.getIntegrityHashLocation();

    if (integrityLoc && await fs.exists(integrityLoc)) {
      const match = await install.matchesIntegrityHash(patterns);
      if (match.matches === false) {
        reportError('integrityHashesDontMatch', match.expected, match.actual);
      }
    } else {
      reportError('noIntegirtyHashFile');
    }
  } else {
    // check if any of the node_modules are out of sync
    const res = await install.linker.getFlatHoistedTree(patterns);
    for (const [loc, {originalKey, pkg, ignore}] of res) {
      if (ignore) {
        continue;
      }

      const parts = humaniseLocation(loc);

      // grey out hoisted portions of key
      let human = originalKey;
      const hoistedParts = parts.slice();
      const hoistedKey = parts.join('#');
      if (human !== hoistedKey) {
        const humanParts = human.split('#');

        for (let i = 0; i < humanParts.length; i++) {
          const humanPart = humanParts[i];

          if (hoistedParts[0] === humanPart) {
            hoistedParts.shift();

            if (i < humanParts.length - 1) {
              humanParts[i] += '#';
            }
          } else {
            humanParts[i] = reporter.format.dim(`${humanPart}#`);
          }
        }

        human = humanParts.join('');
      }

      const pkgLoc = path.join(loc, 'package.json');
      if (!(await fs.exists(loc)) || !(await fs.exists(pkgLoc))) {
        if (pkg._reference.optional) {
          reporter.warn(reporter.lang('optionalDepNotInstalled', human));
        } else {
          reportError('packageNotInstalled', human);
        }
        continue;
      }

      const packageJson = await config.readJson(pkgLoc);
      if (pkg.version !== packageJson.version) {
        // node_modules contains wrong version
        reportError('packageWrongVersion', human, pkg.version, packageJson.version);
      }

      const deps = Object.assign({}, packageJson.dependencies, packageJson.peerDependencies);

      for (const name in deps) {
        const range = deps[name];
        if (!semver.validRange(range, config.looseSemver)) {
          continue; // exotic
        }

        const subHuman = `${human}#${name}@${range}`;

        // find the package that this will resolve to, factoring in hoisting
        const possibles = [];
        let depPkgLoc;
        for (let i = parts.length; i >= 0; i--) {
          const myParts = parts.slice(0, i).concat(name);

          // build package.json location for this position
          const myDepPkgLoc = path.join(
            config.cwd,
            'node_modules',
            myParts.join(`${path.sep}node_modules${path.sep}`),
            'package.json',
          );

          possibles.push(myDepPkgLoc);
        }
        while (possibles.length) {
          const myDepPkgLoc = possibles.shift();
          if (await fs.exists(myDepPkgLoc)) {
            depPkgLoc = myDepPkgLoc;
            break;
          }
        }
        if (!depPkgLoc) {
          // we'll hit the module not install error above when this module is hit
          continue;
        }

        //
        const depPkg = await config.readJson(depPkgLoc);
        const foundHuman = `${humaniseLocation(path.dirname(depPkgLoc)).join('#')}@${depPkg.version}`;
        if (!semver.satisfies(depPkg.version, range, config.looseSemver)) {
          // module isn't correct semver
          reportError('packageDontSatisfy', subHuman, foundHuman);
          continue;
        }

        // check for modules above us that this could be deduped to
        for (const loc of possibles) {
          if (!await fs.exists(loc)) {
            continue;
          }

          const packageJson = await config.readJson(loc);
          if (packageJson.version === depPkg.version ||
             (semver.satisfies(packageJson.version, range, config.looseSemver) &&
             semver.gt(packageJson.version, depPkg.version, config.looseSemver))) {
            reporter.warn(
              reporter.lang(
                'couldBeDeduped',
                subHuman,
                packageJson.version,
                `${humaniseLocation(path.dirname(loc)).join('#')}@${packageJson.version}`,
              ),
            );
            warningCount++;
          }
          break;
        }
      }
    }
  }

  if (warningCount > 1) {
    reporter.info(reporter.lang('foundWarnings', warningCount));
  }

  if (errCount > 0) {
    throw new MessageError(reporter.lang('foundErrors', errCount));
  } else {
    reporter.success(reporter.lang('folderInSync'));
  }
}
