/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import NoopReporter from '../../reporters/base-reporter.js';
import {Install} from './install.js';
import Lockfile from '../../lockfile/wrapper.js';
import buildSubCommands from './_build-sub-commands.js';

export function hasWrapper(flags: Object, args: Array<string>): boolean {
  return args[0] != 'generate-disclaimer';
}

export const {setFlags, run} = buildSubCommands('licenses', {
  ls(): Promise<void> {
    return Promise.reject(new Error('TODO'));
  },

  async generateDisclaimer(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    // install
    const lockfile = await Lockfile.fromDirectory(config.cwd);
    const install = new Install({skipIntegrity: true}, config, new NoopReporter(), lockfile);
    await install.init();

    //
    const manifest = await config.readRootManifest();
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

    for (const {name, license, licenseText, repository} of manifests) {
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
  },
});
