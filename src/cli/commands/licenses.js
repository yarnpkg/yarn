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
import {MessageError} from '../../errors.js';
import {Install} from './install.js';
import Lockfile from '../../lockfile/index.js';

export function hasWrapper(flags: Object, args: Array<string>): boolean {
  return args[0] != 'generate-disclaimer';
}

export function setFlags(commander: Object) {
  commander.usage('licenses [ls | generate-disclaimer]');
}

export async function run(
  config: Config,
  reporter: Reporter,
  flags: Object,
  args: Array<string>,
): Promise<void> {
  // validate subcommand
  const cmd = args[0];
  if (args.length !== 1 || (cmd !== 'generate-disclaimer' && cmd !== 'ls')) {
    throw new MessageError(
      'Invalid subcommand, use `kpm licenses generate-disclaimer` or `kpm licenses ls`',
    );
  }

  const lockfile = await Lockfile.fromDirectory(config.cwd, reporter, {
    silent: true,
    strictIfPresent: true,
  });

  const install = new Install('ls', flags, args, config, reporter, lockfile);

  let [depRequests,, manifest] = await install.fetchRequestFromCwd();
  await install.resolver.init(depRequests);

  if (cmd === 'generate-disclaimer') {
    console.log(
      'THE FOLLOWING SETS FORTH ATTRIBUTION NOTICES FOR THIRD PARTY SOFTWARE THAT MAY BE CONTAINED ' +
      `IN PORTIONS OF THE ${String(manifest.name).toUpperCase().replace(/-/g, ' ')} PRODUCT.`,
    );
    console.log();

    // get manifests and sort them by package name
    let manifests = install.resolver.getManifests();
    manifests = manifests.sort(function(a, b): number {
      if (!a.name && !b.name) {
        return 0;
      }
      
      if (!a.name) {
        return 1;
      }
      
      if (!b.name) {
        return -1;
      }
      
      return a.name.localeCompare(b.name);
    });

    for (let {name, license, licenseText, repository} of manifests) {
      console.log('-----');
      console.log();

      const heading = [];
      heading.push(`The following software may be included in this product: ${name}.`);

      const url = repository && repository.url;
      if (url) {
        heading.push(`A copy of the source code may be downloaded from ${url}.`);
      }

      heading.push('This software contains the following license and notice below:');

      console.log(heading.join(' '));
      console.log();

      if (licenseText) {
        console.log(licenseText.trim());
      } else {
        // what do we do here? base it on `license`?
        license;
      }

      console.log();
    }
  }
}
