import {ArchiveFetcher} from 'miniyarn/fetchers/ArchiveFetcher';
import {BaseMultiFetcher} from 'miniyarn/fetchers/BaseMultiFetcher';
import {makeStubFetcher} from 'miniyarn/fetchers/makeStubFetcher';
import {PackageInfo} from 'miniyarn/models/PackageInfo';
import * as fsUtils from 'miniyarn/utils/fs';
import * as pathUtils from 'miniyarn/utils/path';

class BaseLegacyMirrorFetcher extends BaseMultiFetcher {
  getLegacyMirrorPaths(packageLocator, { env }) {
    return [
      `${env.MIRROR_PATH}/${pathUtils.basename(packageLocator.reference)}`
    ];
  }

  getPrimaryMirrorPath(packageLocator, {env}) {
    return this.getLegacyMirrorPaths(packageLocator, {env})[0];
  }

  async getActiveMirrorPath(packageLocator, {env}) {
    for (let mirrorPath of this.getLegacyMirrorPaths(packageLocator, {env}))
      if (await fsUtils.exists(mirrorPath))
        return mirrorPath;

    return this.getPrimaryMirrorPath(packageLocator, {env});
  }
}

class Save extends BaseLegacyMirrorFetcher {
  async fetch(packageLocator, {env}) {
    if (!env.MIRROR_PATH) {
      return super.fetch(packageLocator, {env});
    }

    if (!packageLocator.name || !packageLocator.reference) {
      return super.fetch(packageLocator, {env});
    }

    return super.fetch(packageLocator, {env}).then(async ({packageInfo, handler}) => {
      return this.saveToMirror(packageInfo, handler, {env});
    });
  }

  async saveToMirror(packageInfo, handler, {env}) {
    let mirrorPath = this.getPrimaryMirrorPath(packageInfo.locator, {env});

    await fsUtils.packToFile(mirrorPath, handler.get(), {
      filter: [`!/${env.ARCHIVE_FILENAME}`],
      virtualPath: `/package`,
    });

    return {packageInfo, handler};
  }
}

class Load extends BaseLegacyMirrorFetcher {
  async fetch(packageLocator, {env}) {
    if (!env.MIRROR_PATH) {
      return super.fetch(packageLocator, {env});
    }

    if (!packageLocator.name || !packageLocator.reference) {
      return super.fetch(packageLocator, {env});
    }

    let fromMirror = await this.fetchFromMirror(packageLocator, {env});

    if (fromMirror) {
      return fromMirror;
    }

    return super.fetch(packageLocator, {env});
  }

  async fetchFromMirror(packageLocator, {env}) {
    let mirrorPath = await this.getActiveMirrorPath(packageLocator, {env});

    if (!await fsUtils.exists(mirrorPath)) {
      return null;
    }

    return new ArchiveFetcher({virtualPath: `/package`}).add(makeStubFetcher({
      packageInfo: new PackageInfo(packageLocator),
      handler: new fsUtils.Handler(mirrorPath),
    })).fetch(packageLocator, {env});
  }
}

export let LegacyMirrorFetcher = {Save, Load};
