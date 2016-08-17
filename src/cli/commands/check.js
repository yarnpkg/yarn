/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import {Install} from './install.js';
import Lockfile from '../../lockfile/index.js';
import * as constants from '../../constants.js';
import * as fs from '../../util/fs.js';
import * as util from '../../util/misc.js';

const semver = require('semver');
const chalk = require('chalk');
const path = require('path');

export const requireLockfile = true;
export const noArguments = true;

export function setFlags(commander: Object) {
  commander.option('--quick-sloppy');
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  const lockfile = await Lockfile.fromDirectory(config.cwd, reporter, {
    silent: true,
    strict: true,
  });

  const install = new Install('update', flags, args, config, reporter, lockfile, true);

  function humaniseLocation(loc: string): Array<string> {
    const relative = path.relative(path.join(config.cwd, 'node_modules'), loc);
    return relative.split(new RegExp(`${path.sep}node_modules${path.sep}`, 'g'));
  }

  let warningCount = 0;
  let errCount = 0;
  function reportError(msg) {
    reporter.error(msg);
    errCount++;
  }

  // get patterns that are installed when running `kpm install`
  let [depRequests, rawPatterns] = await install.fetchRequestFromCwd();

  // check if patterns exist in lockfile
  for (const pattern of rawPatterns) {
    if (!lockfile.getLocked(pattern)) {
      reportError(`Lockfile does not contain pattern: ${pattern}`);
    }
  }

  if (flags.quickSloppy) {
    // in sloppy mode we don't resolve dependencies, we just check a hash of the lockfile
    // against one that is created when we run `kpm install`
    const integrityLoc = path.join(config.cwd, 'node_modules', constants.INTEGRITY_FILENAME);

    if (await fs.exists(integrityLoc)) {
      const actual = await fs.readFile(integrityLoc);
      const expected = util.hash(lockfile.source);

      if (actual.trim() !== expected) {
        reportError(`Expected an integrity hash of ${expected} but got ${actual}`);
      }
    } else {
      reportError("Couldn't find an integrity hash file");
    }
  } else {
    // seed resolver
    await install.resolver.init(depRequests);

    // check if any of the node_modules are out of sync
    const res = await install.linker.getFlatHoistedTree(rawPatterns);
    for (let [loc, {originalKey, pkg}] of res) {
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
            humanParts[i] = chalk.dim(`${humanPart}#`);
          }
        }

        human = humanParts.join('');
      }

      const pkgLoc = path.join(loc, 'package.json');
      if (!(await fs.exists(loc)) || !(await fs.exists(pkgLoc))) {
        reportError(`${human} not installed`);
      }
      const packageJson = await fs.readJson(pkgLoc);
      if (pkg.version !== packageJson.version) {
        // node_modules contains wrong version
        reportError(`${human} is wrong version: expected ${pkg.version}, got ${packageJson.version}`);
      }

      const deps = Object.assign({}, packageJson.dependencies, packageJson.peerDependencies);

      for (const name in deps) {
        const range = deps[name];
        if (!semver.validRange(range)) {
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
        const depPkg = await fs.readJson(depPkgLoc);
        const foundHuman = `${humaniseLocation(path.dirname(depPkgLoc)).join('#')}@${depPkg.version}`;
        if (!semver.satisfies(depPkg.version, range)) {
          // module isn't correct semver
          reportError(`${subHuman} doesn't satisfy found match of ${foundHuman}`);
          continue;
        }

        // check for modules above us that this could be deduped to
        for (const loc of possibles) {
          if (!await fs.exists(loc)) {
            continue;
          }

          const packageJson = await fs.readJson(loc);
          if (packageJson.version === depPkg.version ||
             (semver.satisfies(packageJson.version, range) &&
             semver.gt(packageJson.version, depPkg.version))) {
            reporter.warn(
              `${subHuman} could be deduped from ${packageJson.version} to ` +
              `${humaniseLocation(path.dirname(loc)).join('#')}@${packageJson.version}`,
            );
            warningCount++;
          }
          break;
        }
      }
    }
  }

  if (warningCount > 1) {
    reporter.info(`Found ${warningCount} warnings`);
  }

  if (errCount > 0) {
    if (errCount > 1) {
      reporter.info(`Found ${errCount} errors`);
    }
    
    return Promise.reject();
  } else {
    reporter.success('Folder in sync');
    return Promise.resolve();
  }
}
