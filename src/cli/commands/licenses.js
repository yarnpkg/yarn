/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import type {Manifest} from '../../types.js';
import NoopReporter from '../../reporters/base-reporter.js';
import {Install} from './install.js';
import Lockfile from '../../lockfile/wrapper.js';
import buildSubCommands from './_build-sub-commands.js';

const invariant = require('invariant');

export function hasWrapper(flags: Object, args: Array<string>): boolean {
  return args[0] != 'generate-disclaimer';
}

async function getManifests(config: Config, flags: Object): Promise<Array<Manifest>> {
  const lockfile = await Lockfile.fromDirectory(config.cwd);
  const install = new Install({skipIntegrityCheck: true, ...flags}, config, new NoopReporter(), lockfile);
  await install.hydrate(true);

  let manifests = install.resolver.getManifests();

  // sort by name
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

  // filter ignored manifests
  manifests = manifests.filter((manifest: Manifest): boolean => {
    const ref = manifest._reference;
    return !!ref && !ref.ignore;
  });

  return manifests;
}

export const {run, setFlags, examples} = buildSubCommands('licenses', {
  async ls(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    const manifests: Array<Manifest> = await getManifests(config, flags);

    if (flags.json) {
      const body = [];

      for (const {name, version, license, repository, homepage, author} of manifests) {
        const url = repository ? repository.url : homepage;
        const vendorUrl = homepage || (author && author.url);
        const vendorName = author && author.name;
        body.push([
          name,
          version,
          license || 'Unknown',
          url || 'Unknown',
          vendorUrl || 'Unknown',
          vendorName || 'Unknown',
        ]);
      }

      reporter.table(['Name', 'Version', 'License', 'URL', 'VendorUrl', 'VendorName'], body);
    } else {
      const trees = [];

      for (const {name, version, license, repository, homepage} of manifests) {
        const children = [];
        children.push({
          name: `${reporter.format.bold('License:')} ${license || reporter.format.red('UNKNOWN')}`,
        });

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

  async generateDisclaimer(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    const manifests: Array<Manifest> = await getManifests(config, flags);
    const manifest = await config.readRootManifest();

    // Create a map of license text to manifest so that packages with exactly
    // the same license text are grouped together.
    const manifestsByLicense: Map<string, Map<string, Manifest>> = new Map();
    for (const manifest of manifests) {
      const {licenseText} = manifest;
      if (!licenseText) {
        continue;
      }

      if (!manifestsByLicense.has(licenseText)) {
        manifestsByLicense.set(licenseText, new Map());
      }

      const byLicense = manifestsByLicense.get(licenseText);
      invariant(byLicense, 'expected value');
      byLicense.set(manifest.name, manifest);
    }

    console.log(
      'THE FOLLOWING SETS FORTH ATTRIBUTION NOTICES FOR THIRD PARTY SOFTWARE THAT MAY BE CONTAINED ' +
        `IN PORTIONS OF THE ${String(manifest.name).toUpperCase().replace(/-/g, ' ')} PRODUCT.`,
    );
    console.log();

    for (const [licenseText, manifests] of manifestsByLicense) {
      console.log('-----');
      console.log();

      const names = [];
      const urls = [];
      for (const [name, {repository}] of manifests) {
        names.push(name);
        if (repository && repository.url) {
          urls.push(manifests.size === 1 ? repository.url : `${repository.url} (${name})`);
        }
      }

      const heading = [];
      heading.push(`The following software may be included in this product: ${names.join(', ')}.`);
      if (urls.length > 0) {
        heading.push(`A copy of the source code may be downloaded from ${urls.join(', ')}.`);
      }
      heading.push('This software contains the following license and notice below:');

      console.log(heading.join(' '));
      console.log();

      if (licenseText) {
        console.log(licenseText.trim());
      } else {
        // what do we do here? base it on `license`?
      }

      console.log();
    }
  },
});
