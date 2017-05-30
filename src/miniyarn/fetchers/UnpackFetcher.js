import {BaseMultiFetcher} from 'miniyarn/fetchers/BaseMultiFetcher';
import * as fsUtils from 'miniyarn/utils/fs';

export class UnpackFetcher extends BaseMultiFetcher {
  async fetch(packageLocator, {env}) {
    return super.fetch(packageLocator, {env}).then(async ({packageInfo, handler: archiveHandler}) => {
      let destination = await fsUtils.createTemporaryFolder();
      await fsUtils.extract(destination, archiveHandler.get());

      // "Steal" the tarball to put it into the folder (we will need it to populate the offline mirror later)
      await fsUtils.mv(await archiveHandler.steal(), `${destination}/${env.ARCHIVE_FILENAME}`);

      return {packageInfo, handler: new fsUtils.Handler(destination, {temporary: true})};
    });
  }
}
