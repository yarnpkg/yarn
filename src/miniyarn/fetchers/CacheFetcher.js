import {BaseMultiFetcher} from 'miniyarn/fetchers/BaseMultiFetcher';
import {PackageInfo} from 'miniyarn/models/PackageInfo';
import * as fsUtils from 'miniyarn/utils/fs';
import * as yarnUtils from 'miniyarn/utils/yarn';

export class CacheFetcher extends BaseMultiFetcher {
  async fetch(packageLocator, {env}) {
    if (!env.CACHE_PATH) return super.fetch(packageLocator, {env});

    if (!packageLocator.name || !packageLocator.reference) return super.fetch(packageLocator, {env});

    return (
      (await this.fetchFromCache(packageLocator, {env})) ||
      super.fetch(packageLocator, {env}).then(({packageInfo, handler}) => {
        return this.saveToCache(packageInfo, handler, {env});
      })
    );
  }

  async fetchFromCache(packageLocator, {env}) {
    let cacheAtomicPath = this.getCacheAtomicPath(packageLocator, {env});

    if (!await fsUtils.exists(cacheAtomicPath)) return null;

    let cachePath = this.getCachePath(packageLocator, {env});
    let cacheInfoPath = this.getCacheInfoPath(packageLocator, {env});

    let packageInfo = new PackageInfo((await fsUtils.readJson(cacheInfoPath))).merge(packageLocator);

    return {packageInfo, handler: new fsUtils.Handler(cachePath)};
  }

  async saveToCache(packageInfo, packageHandler, {env, force = false}) {
    let cachePath = this.getCachePath(packageInfo.locator, {env});
    let cacheAtomicPath = this.getCacheAtomicPath(packageInfo.locator, {env});

    if ((await fsUtils.exists(cacheAtomicPath)) && !force)
      throw new Error(`Cannot override a cache entry without using the force option`);

    // Delete the current directory before extracting (in case we started to extract it but stopped it midway)
    await fsUtils.rm(cachePath);

    // "Steal" the directory from our handler to put it into the cache folder
    await fsUtils.mv(await packageHandler.steal(), cachePath);

    // Write the atomic marker so that further request to the cache will be served from here
    await yarnUtils.writeAtomicFile(cacheAtomicPath);

    return {packageInfo, handler: new fsUtils.Handler(cachePath)};
  }

  getCachePath(packageLocator, {env}) {
    return `${env.CACHE_PATH}/${packageLocator.name}/${yarnUtils.getLocatorSlugIdentifier(packageLocator)}`;
  }

  getCacheAtomicPath(packageLocator, {env}) {
    return `${this.getCachePath(packageLocator, {env})}/${env.ATOMIC_FILENAME}`;
  }

  getCacheInfoPath(packageLocator, {env}) {
    return `${this.getCachePath(packageLocator, {env})}/${env.INFO_FILENAME}`;
  }
}
