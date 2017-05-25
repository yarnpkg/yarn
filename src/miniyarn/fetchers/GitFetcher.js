import invariant from 'invariant';

import {BaseFetcher} from 'miniyarn/fetchers/BaseFetcher';
import {PackageInfo} from 'miniyarn/models/PackageInfo';
import * as execUtils from 'miniyarn/utils/exec';
import * as fsUtils from 'miniyarn/utils/fs';
import * as miscUtils from 'miniyarn/utils/misc';

export class GitFetcher extends BaseFetcher {
  supports(packageLocator, {env}) {
    if (!packageLocator.name || !packageLocator.reference) return false;

    return miscUtils.isGitReference(packageLocator.reference);
  }

  async fetch(packageLocator, {env}) {
    try {
      return await this.fetchViaArchive(packageLocator, {env});
    } catch (error) {
      return await this.fetchViaClone(packageLocator, {env});
    }
  }

  async fetchViaArchive(packageLocator, {env}) {
    throw new Error(`Unsupported`);
  }

  async fetchViaClone(packageLocator, {env}) {
    invariant(packageLocator.name, `This package locator should have a name`);
    invariant(packageLocator.reference, `This package locator should have a reference`);

    let archivePath = await fsUtils.createTemporaryFile();
    let archiveHandler = new fsUtils.Handler(archivePath, {temporary: true});

    let clonePath = await fsUtils.createTemporaryFolder();

    // Split the git repository url and the reference we'll need to checkout
    let [, gitUrl, tagBranchCommit] = packageLocator.reference.match(/^([^#]*)(?:#(.*))$/);

    // Clone the directory, and remove its history since we don't really care about it
    await execUtils.execFile(`git`, [`clone`, `--depth=1`, `--`, gitUrl, `.`], {cwd: clonePath});
    if (tagBranchCommit) await execUtils.execFile(`git`, [`checkout`, `-b`, tagBranchCommit], {cwd: clonePath});
    await fsUtils.rm(`${clonePath}/.git`);

    // Remove some internal files, just in case they have been accidentally committed (?!)
    await fsUtils.rm(`${clonePath}/${env.ARCHIVE_FILENAME}`);
    await fsUtils.rm(`${clonePath}/${env.ATOMIC_FILENAME}`);
    await fsUtils.rm(`${clonePath}/${env.INFO_FILENAME}`);

    // Extract the package.json file info, and save them in our normalized file format
    let packageInfo = new PackageInfo(JSON.parse(await fsUtils.readFile(`${clonePath}/package.json`, `utf8`))).merge(
      packageLocator,
    );
    await fsUtils.writeFile(`${clonePath}/${env.INFO_FILENAME}`, JSON.stringify(packageInfo.toJSON()));

    // Pack everything into a single archive, and forward it
    await fsUtils.packToFile(archivePath, clonePath);

    return {packageInfo, handler: archiveHandler};
  }
}
