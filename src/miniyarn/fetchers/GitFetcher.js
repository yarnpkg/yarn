import invariant from 'invariant';

import {BaseFetcher} from 'miniyarn/fetchers/BaseFetcher';
import {PackageInfo} from 'miniyarn/models/PackageInfo';
import * as execUtils from 'miniyarn/utils/exec';
import * as fsUtils from 'miniyarn/utils/fs';
import * as miscUtils from 'miniyarn/utils/misc';

export class GitFetcher extends BaseFetcher {
  supports(packageLocator, {env, ... rest}) {
    if (!packageLocator.name || !packageLocator.reference) {
      return false;
    }

    if (!miscUtils.isGitReference(packageLocator.reference)) {
      return false;
    }

    return true;
  }

  async fetch(packageLocator, {env, ... rest}) {
    return await miscUtils.tryWithFallbacks(async () => {
      return await this.fetchViaArchive(packageLocator, {env, ... rest});
    }, async () => {
      return await this.fetchViaClone(packageLocator, {env, ... rest});
    });
  }

  async fetchViaArchive(packageLocator, {env, ... rest}) {
    throw new Error(`Unsupported`);
  }

  async fetchViaClone(packageLocator, {env, ... rest}) {
    invariant(packageLocator.name, `This package locator should have a name`);
    invariant(packageLocator.reference, `This package locator should have a reference`);

    if (!env.NETWORK_ENABLED) {
      throw new Error(`Fetching this package requires network capabilities (${yarnUtils.getLocatorIdentifier(packageLocator)})`);
    }

    let archivePath = await fsUtils.createTemporaryFile();
    let archiveHandler = new fsUtils.Handler(archivePath, {temporary: true});

    let clonePath = await fsUtils.createTemporaryFolder();

    // Split the git repository url and the reference we'll need to checkout
    let [, gitUrl, tagBranchCommit = `master`] = packageLocator.reference.match(/^([^#]*)(?:#(.*))?$/);

    // Clone a specific commit, and only this one
    await execUtils.execFile(`git`, [`init`], {cwd: clonePath});
    await execUtils.execFile(`git`, [`remote`, `add`, `origin`, gitUrl], {cwd: clonePath});

    // Some git servers (Github?) don't support fetching specific commits - in this case, we must fetch everything
    await miscUtils.tryWithFallbacks(async () => {
      await execUtils.execFile(`git`, [`fetch`, `origin`, tagBranchCommit], {cwd: clonePath});
    }, async () => {
      await execUtils.execFile(`git`, [`fetch`, `origin`], {cwd: clonePath});
    })

    // Reset the directory to use the specified reference (we can't use FETCH_HEAD because of the trick above)
    await miscUtils.tryWithFallbacks(async () => {
      await execUtils.execFile(`git`, [`reset`, `--hard`, tagBranchCommit], {cwd: clonePath});
    }, async () => {
      await execUtils.execFile(`git`, [`reset`, `--hard`, `remotes/origin/${tagBranchCommit}`], {cwd: clonePath});
    });

    // Remove the history, since we don't plan to use it anymore
    await fsUtils.rm(`${clonePath}/.git`);

    // Pack everything into a single archive, and forward it
    await fsUtils.packToFile(archivePath, clonePath);

    return {packageInfo: new PackageInfo(packageLocator), handler: archiveHandler};
  }
}
