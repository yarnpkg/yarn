/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import type {Manifest} from '../../types.js';
import NoopReporter from '../../reporters/base-reporter.js';
import {Install} from './install.js';
import Lockfile from '../../lockfile/wrapper.js';
import buildSubCommands from './_build-sub-commands.js';

export function hasWrapper(flags: Object, args: Array<string>): boolean {
  return args[0] != 'generate-disclaimer';
}

export function setFlags(commander: Object) {
  setUsage(commander);
  commander.option('--production', '');
}

async function getManifests(config: Config, flags: Object): Promise<Array<Manifest>> {
  const lockfile = await Lockfile.fromDirectory(config.cwd);
  const install = new Install({skipIntegrity: true, ...flags}, config, new NoopReporter(), lockfile);
  await install.init();

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
  return manifests;
}

const {setFlags: setUsage, run} = buildSubCommands('licenses', {
  async ls(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    const manifests = await getManifests(config, flags);

    if (flags.json) {
      const body = [];

      for (const {name, version, license, repository, homepage} of manifests) {
        const url = repository ? repository.url : homepage;
        body.push([name, version, license || 'Unknown', url || 'Unknown']);
      }

      reporter.table(['Name', 'Version', 'License', 'URL'], body);
    } else {
      const trees = [];

      for (const {name, version, license, repository, homepage} of manifests) {
        const children = [];
        children.push({name: `${reporter.format.bold('License:')} ${license || reporter.format.red('UNKNOWN')}`});

        const url = repository ? repository.url : homepage;
        if (url) {
          children.push({name: `${reporter.format.bold('URL:')} ${url}`});
        }

        trees.push({
          name: `${name}@${version}`,
          children,
        });
      }

      reporter.tree('licenses', trees);
    }
  },

  async generateDisclaimer(
    config: Config,
    reporter: Reporter,
    flags: Object,
    args: Array<string>,
  ): Promise<void> {
    const manifests = await getManifests(config, flags);
    const manifest = await config.readRootManifest();
    console.log(
      'THE FOLLOWING SETS FORTH ATTRIBUTION NOTICES FOR THIRD PARTY SOFTWARE THAT MAY BE CONTAINED ' +
      `IN PORTIONS OF THE ${String(manifest.name).toUpperCase().replace(/-/g, ' ')} PRODUCT.`,
    );
    console.log();

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

export {run};
