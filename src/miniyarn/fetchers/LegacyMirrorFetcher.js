import {ArchiveFetcher} from 'miniyarn/fetchers/ArchiveFetcher';
import {BaseMultiFetcher} from 'miniyarn/fetchers/BaseMultiFetcher';
import {makeStubFetcher} from 'miniyarn/fetchers/makeStubFetcher';
import {PackageInfo} from 'miniyarn/models/PackageInfo';
import * as fsUtils from 'miniyarn/utils/fs';
import * as pathUtils from 'miniyarn/utils/path';
import * as yarnUtils from 'miniyarn/utils/yarn';

class BaseLegacyMirrorFetcher extends BaseMultiFetcher {
  getLegacyMirrorPaths(packageLocator, {env, ... rest}) {
    let {scope} = yarnUtils.parseIdentifier(packageLocator.name);

    return [ scope && !pathUtils.basename(packageLocator.reference).match(/^@/)
      ? `${env.MIRROR_PATH}/@${scope}-${pathUtils.basename(packageLocator.reference)}`
      : `${env.MIRROR_PATH}/${pathUtils.basename(packageLocator.reference)}`
    ];
  }

  getPrimaryMirrorPath(packageLocator, {env, ... rest}) {
    return this.getLegacyMirrorPaths(packageLocator, {env, ... rest})[0];
  }

  async getActiveMirrorPath(packageLocator, {env, ... rest}) {
    for (let mirrorPath of this.getLegacyMirrorPaths(packageLocator, {env, ... rest})) {
      if (await fsUtils.exists(mirrorPath)) {
        return mirrorPath;
      }
    }

    return this.getPrimaryMirrorPath(packageLocator, {env, ... rest});
  }
}

class Delete extends BaseLegacyMirrorFetcher {
  async fetch(packageLocator, {env, ... rest}) {
    if (!env.MIRROR_PATH) {
      return super.fetch(packageLocator, {env, ... rest});
    }

    if (!packageLocator.name || !packageLocator.reference) {
      return super.fetch(packageLocator, {env, ... rest});
    }

    return super.fetch(packageLocator, {env, ... rest}).then(async ({packageInfo, handler}) => {
      return this.deleteFromMirror(packageInfo, handler, {env, ... rest});
    });
  }

  async deleteFromMirror(packageInfo, handler, {env, ... rest}) {
    let mirrorPath = this.getPrimaryMirrorPath(packageInfo.locator, {env, ... rest});

    if (await fsUtils.exists(mirrorPath) && pathUtils.normalize(mirrorPath) !== pathUtils.normalize(handler.get())) {
      await fsUtils.rm(mirrorPath);
    }

    return {packageInfo, handler};
  }
}

class Save extends BaseLegacyMirrorFetcher {
  async fetch(packageLocator, {env, ... rest}) {
    if (!env.MIRROR_PATH) {
      return super.fetch(packageLocator, {env, ... rest});
    }

    if (!packageLocator.name || !packageLocator.reference) {
      return super.fetch(packageLocator, {env, ... rest});
    }

    return super.fetch(packageLocator, {env, ... rest}).then(async ({packageInfo, handler}) => {
      return this.saveToMirror(packageInfo, handler, {env, ... rest});
    });
  }

  async saveToMirror(packageInfo, handler, {env, ... rest}) {
    let mirrorPath = this.getPrimaryMirrorPath(packageInfo.locator, {env, ... rest});

    await fsUtils.packToFile(mirrorPath, handler.get(), {
      filter: [`!/${env.ARCHIVE_FILENAME}`],
      virtualPath: `/package`,
    });

    return {packageInfo, handler};
  }
}

class Load extends BaseLegacyMirrorFetcher {
  async fetch(packageLocator, {env, ... rest}) {
    if (!env.MIRROR_PATH) {
      return super.fetch(packageLocator, {env, ... rest});
    }

    if (!packageLocator.name || !packageLocator.reference) {
      return super.fetch(packageLocator, {env, ... rest});
    }

    let fromMirror = await this.fetchFromMirror(packageLocator, {env, ... rest});

    if (fromMirror) {
      return fromMirror;
    }

    return super.fetch(packageLocator, {env, ... rest});
  }

  async fetchFromMirror(packageLocator, {env, ... rest}) {
    let mirrorPath = await this.getActiveMirrorPath(packageLocator, {env, ... rest});

    if (!await fsUtils.exists(mirrorPath)) {
      return null;
    }

    // In the legacy mirror, the archives were not standardized accross fetchers, so the package.json file was not always located at the same place, depending on the fetcher.
    // In order to solve this, we try to locate the closest package.json file, and use it as the "virtual path" of the archive.

    let listing = await fsUtils.readArchiveListing(mirrorPath);
    let packageJsonEntries = listing.filter(listing => pathUtils.basename(listing) === `package.json`);

    if (packageJsonEntries.length === 0) {
      throw new Error(`An offline archive has been found, but no package.json file can be located inside`);
    }

    let rootPackageJson = packageJsonEntries.sort((a, b) => pathUtils.getDepth(a) - pathUtils.getDepth(b))[0];
    let virtualPath = pathUtils.dirname(rootPackageJson);

    return new ArchiveFetcher({virtualPath}).add(makeStubFetcher({
      packageInfo: new PackageInfo(packageLocator),
      handler: new fsUtils.Handler(mirrorPath),
    })).fetch(packageLocator, {env, ... rest});
  }
}

export let LegacyMirrorFetcher = {Save, Delete, Load};
