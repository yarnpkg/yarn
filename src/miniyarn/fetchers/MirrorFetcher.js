import * as Path from 'path';

import {BaseMultiFetcher} from 'miniyarn/fetchers/BaseMultiFetcher';
import {PackageInfo} from 'miniyarn/models/PackageInfo';
import * as archiveUtils from 'miniyarn/utils/archive';
import * as fsUtils from 'miniyarn/utils/fs';
import * as yarnUtils from 'miniyarn/utils/yarn';

class BaseMirrorFetcher extends BaseMultiFetcher {
  getMirrorPath(packageLocator, {env}) {
    return `${env.MIRROR_PATH}/${packageLocator.name}/${yarnUtils.getLocatorSlugIdentifier(packageLocator)}${Path.extname(env.ARCHIVE_FILENAME)}`;
  }
}

class Save extends BaseMirrorFetcher {
  async fetch(packageLocator, {env}) {
    if (!env.MIRROR_PATH) return super.fetch(packageLocator, {env});

    if (!packageLocator.name || !packageLocator.reference) return super.fetch(packageLocator, {env});

    return super.fetch(packageLocator, {env}).then(async ({packageInfo, handler: unpackedHandler}) => {
      let mirrorPath = this.getMirrorPath(packageLocator, {env});

      if (!await fsUtils.exists(mirrorPath))
        await fsUtils.cp(`${unpackedHandler.get()}/${env.ARCHIVE_FILENAME}`, mirrorPath);

      return {packageInfo, handler: unpackedHandler};
    });
  }
}

class Load extends BaseMirrorFetcher {
  async fetch(packageLocator, {env}) {
    let mirrorPath = this.getMirrorPath(packageLocator, {env});

    if (!await fsUtils.exists(mirrorPath)) return super.fetch(packageLocator, {env});

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
