import * as Path from 'path';

import {BaseMultiFetcher} from 'miniyarn/fetchers/BaseMultiFetcher';
import {PackageInfo} from 'miniyarn/models/PackageInfo';
import * as archiveUtils from 'miniyarn/utils/archive';
import * as fsUtils from 'miniyarn/utils/fs';
import * as pathUtils from 'miniyarn/utils/path';
import * as yarnUtils from 'miniyarn/utils/yarn';

class BaseMirrorFetcher extends BaseMultiFetcher {
  getMirrorPath(packageLocator, {env, ... rest}) {
    return `${env.MIRROR_PATH}/${packageLocator.name}/${yarnUtils.getLocatorSlugIdentifier(packageLocator)}${pathUtils.extname(env.ARCHIVE_FILENAME)}`;
  }
}

class Save extends BaseMirrorFetcher {
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
    let mirrorPath = this.getMirrorPath(packageInfo.locator, {env, ... rest});

    if (!await fsUtils.exists(mirrorPath)) {
      await fsUtils.cp(`${handler.get()}/${env.ARCHIVE_FILENAME}`, mirrorPath);
    }

    return {packageInfo, handler};
  }
}

class Load extends BaseMirrorFetcher {
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
    let mirrorPath = this.getMirrorPath(packageLocator, {env, ... rest});

    if (!await fsUtils.exists(mirrorPath)) {
      return null;
    }

    let packageInfoExtractor = archiveUtils.createFileExtractor(env.INFO_FILENAME);

    let archiveUnpacker = archiveUtils.createArchiveUnpacker();
    archiveUnpacker.pipe(packageInfoExtractor);

    let inputStream = fsUtils.createFileReader(mirrorPath);
    inputStream.pipe(archiveUnpacker);

    let packageInfo = new PackageInfo(JSON.parse(await packageInfoExtractor.promise)).merge(packageLocator);

    return {packageInfo, handler: new fsUtils.Handler(mirrorPath)};
  }
}

export let MirrorFetcher = {Save, Load};
