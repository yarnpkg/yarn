/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import type {Manifest} from '../../types.js';
import NoopReporter from '../../reporters/base-reporter.js';
import {Install} from './install.js';
import Lockfile from '../../lockfile';
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

async function list(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  const manifests: Array<Manifest> = await getManifests(config, flags);
  const manifestsByLicense = new Map();

  for (const {name, version, license, repository, homepage, author} of manifests) {
    const licenseKey = license || 'UNKNOWN';
    const url = repository ? repository.url : homepage;
    const vendorUrl = homepage || (author && author.url);
    const vendorName = author && author.name;

    if (!manifestsByLicense.has(licenseKey)) {
      manifestsByLicense.set(licenseKey, new Map());
    }

    const byLicense = manifestsByLicense.get(licenseKey);
    invariant(byLicense, 'expected value');
    byLicense.set(`${name}@${version}`, {
      name,
      version,
      url,
      vendorUrl,
      vendorName,
    });
  }

  if (flags.json) {
    const body = [];

    manifestsByLicense.forEach((license, licenseKey) => {
      license.forEach(({name, version, url, vendorUrl, vendorName}) => {
        body.push([name, version, licenseKey, url || 'Unknown', vendorUrl || 'Unknown', vendorName || 'Unknown']);
      });
    });

    reporter.table(['Name', 'Version', 'License', 'URL', 'VendorUrl', 'VendorName'], body);
  } else {
    const trees = [];

    manifestsByLicense.forEach((license, licenseKey) => {
      const licenseTree = [];

      license.forEach(({name, version, url, vendorUrl, vendorName}) => {
        const children = [];

        if (url) {
          children.push({name: `${reporter.format.bold('URL:')} ${url}`});
        }

        if (vendorUrl) {
          children.push({name: `${reporter.format.bold('VendorUrl:')} ${vendorUrl}`});
        }

        if (vendorName) {
          children.push({name: `${reporter.format.bold('VendorName:')} ${vendorName}`});
        }

        licenseTree.push({
          name: `${name}@${version}`,
          children,
        });
      });

      trees.push({
        name: licenseKey,
        children: licenseTree,
      });
    });

    reporter.tree('licenses', trees, {force: true});
  }
}
export function setFlags(commander: Object) {
  commander.description('Lists licenses for installed packages.');
}
export const {run, examples} = buildSubCommands('licenses', {
  async ls(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    reporter.warn(`\`yarn licenses ls\` is deprecated. Please use \`yarn licenses list\`.`);
    await list(config, reporter, flags, args);
  },

  async list(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    await list(config, reporter, flags, args);
  },

  async generateDisclaimer(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
    /* eslint-disable no-console */

    // `reporter.log` dumps a bunch of ANSI escapes to clear the current line and
    // is for abstracting the console output so it can be consumed by other tools
    // (JSON output being the primary one). This command is only for text consumption
    // and you should just be dumping it to a TXT file. Using a reporter here has the
    // potential to mess up the output since it might print ansi escapes.
    // @kittens - https://git.io/v7uts

    const manifests: Array<Manifest> = await getManifests(config, flags);
    const manifest = await config.readRootManifest();

    // Create a map of license text to manifest so that packages with exactly
    // the same license text are grouped together.
    const manifestsByLicense: Map<string, Map<string, Manifest>> = new Map();
    for (const manifest of manifests) {
      const {licenseText, noticeText} = manifest;
      let licenseKey;
      if (!licenseText) {
        continue;
      }

      if (!noticeText) {
        licenseKey = licenseText;
      } else {
        licenseKey = `${licenseText}\n\nNOTICE\n\n${noticeText}`;
      }

      if (!manifestsByLicense.has(licenseKey)) {
        manifestsByLicense.set(licenseKey, new Map());
      }

      const byLicense = manifestsByLicense.get(licenseKey);
      invariant(byLicense, 'expected value');
      byLicense.set(manifest.name, manifest);
    }

    console.log(
      'THE FOLLOWING SETS FORTH ATTRIBUTION NOTICES FOR THIRD PARTY SOFTWARE THAT MAY BE CONTAINED ' +
        `IN PORTIONS OF THE ${String(manifest.name).toUpperCase().replace(/-/g, ' ')} PRODUCT.`,
    );
    console.log();

    for (const [licenseKey, manifests] of manifestsByLicense) {
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

      if (licenseKey) {
        console.log(licenseKey.trim());
      } else {
        // what do we do here? base it on `license`?
      }

      console.log();
    }
  },
});
