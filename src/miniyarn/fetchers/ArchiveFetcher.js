import {BaseMultiFetcher} from 'miniyarn/fetchers/BaseMultiFetcher';
import {PackageInfo} from 'miniyarn/models/PackageInfo';
import * as archiveUtils from 'miniyarn/utils/archive';
import * as fsUtils from 'miniyarn/utils/fs';
import * as parseUtils from 'miniyarn/utils/parse';

export class ArchiveFetcher extends BaseMultiFetcher {
  virtualPath: ?string;

  constructor({virtualPath = null, ...rest}: {virtualPath: ?string, rest: Object} = {}) {
    super();

    this.virtualPath = virtualPath;
  }

  async fetch(packageLocator: any, {env}) {
    return await super.fetch(packageLocator, {env}).then(async ({handler}) => {
      return await this.normalize(packageLocator, handler, {env});
    });
  }

  async normalize(packageLocator, archiveHandler, {env}) {
    let normalizedArchivePath = await fsUtils.createTemporaryFile();
    let normalizedArchiveHandler = new fsUtils.Handler(normalizedArchivePath, {temporary: true});

    let normalizedOutputStream = await fsUtils.createFileWriter(normalizedArchivePath);
    let packageInfoExtractor = archiveUtils.createFileExtractor(`package.json`);

    let normalizedArchiveWriter = archiveUtils.createTarballWriter();
    normalizedArchiveWriter.pipe(normalizedOutputStream);

    let archiveUnpacker = archiveUtils.createArchiveUnpacker({virtualPath: this.virtualPath});
    archiveUnpacker.pipe(normalizedArchiveWriter, {
      end: false,
      filter: [`!/${env.INFO_FILENAME}`, `!/${env.ARCHIVE_FILENAME}`, `!/${env.ATOMIC_FILENAME}`],
    });
    archiveUnpacker.pipe(packageInfoExtractor);

    let archiveReader = fsUtils.createFileReader(archiveHandler.get());
    archiveReader.pipe(archiveUnpacker);

    // We now wait until we get the package.json file info, and merge it with our own data
    let packageInfo = new PackageInfo(parseUtils.parseJson(await packageInfoExtractor.promise)).merge(packageLocator);

    // We also want to wait for the unpacker to be fully streamed, so that our new entry will be added at the end
    await archiveUnpacker.promise;

    // We can now write our new entry for the meta file, and manually close the stream since noone else will write anymore in it
    normalizedArchiveWriter.entry({name: env.INFO_FILENAME}, JSON.stringify(packageInfo.toJSON()));
    normalizedArchiveWriter.finalize();

    // Finally, we just wait for the archive to be fully written before returning
    await normalizedOutputStream.promise;

    return {packageInfo, handler: normalizedArchiveHandler};
  }
}
