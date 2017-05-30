import {BaseMultiFetcher} from 'miniyarn/fetchers/BaseMultiFetcher';
import {PackageInfo} from 'miniyarn/models/PackageInfo';
import * as fsUtils from 'miniyarn/utils/fs';

export class DirectoryFetcher extends BaseMultiFetcher {
  async fetch(packageLocator, {env}) {
    return super.fetch(packageLocator, {env}).then(({packageInfo, handler}) => {
      return this.prepare(packageLocator, handler, {env});
    });
  }

  async prepare(packageLocator, handler, {env}) {
    let normalizedDirectoryPath = await handler.steal();
    let normalizedDirectoryHandler = new fsUtils.Handler(normalizedDirectoryPath, {temporary: true});

    // We read the package.json and merge it with our own data, so
    let packageInfo = new PackageInfo(await fsUtils.readJson(`${normalizedDirectoryPath}/package.json`)).merge(packageLocator);
    await fsUtils.writeJson(`${normalizedDirectoryPath}/${env.INFO_FILENAME}`, packageInfo.toJSON());

    return {packageInfo, handler: normalizedDirectoryHandler};
  }
}
