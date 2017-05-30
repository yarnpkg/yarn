import {BaseFetcher} from 'miniyarn/fetchers/BaseFetcher';
import {PackageInfo} from 'miniyarn/models/PackageInfo';
import * as fsUtils from 'miniyarn/utils/fs';
import * as miscUtils from 'miniyarn/utils/misc';
import * as pathUtils from 'miniyarn/utils/path';

export class FsEntryFetcher extends BaseFetcher {
  constructor({pathPattern = null, type = null} = {}) {
    super();

    this.pathPattern = pathPattern;
  }

  supports(packageLocator, {env}) {
    if (!packageLocator.reference) {
      return false;
    }

    if (!pathUtils.isPathForSure(packageLocator.reference)) {
      return false;
    }

    if (this.pathPattern && !miscUtils.filePatternMatch(packageLocator.reference, this.pathPattern)) {
      return false;
    }

    return true;
  }

  async fetch(packageLocator, {env}) {
    let reference = packageLocator.reference;

    if (!pathUtils.isAbsolute(reference)) {
      if (!env.RELATIVE_DEPENDENCIES_PATH) {
        throw new Error(`Relative filesystem dependencies cannot be fetched unless RELATIVE_DEPENDENCIES_PATH is defined`);
      } else if (!pathUtils.isAbsolute(env.RELATIVE_DEPENDENCIES_PATH)) {
        throw new Error(`The RELATIVE_DEPENDENCIES_PATH constant shouldn't be a relative path`);
      } else {
        reference = pathUtils.resolve(env.RELATIVE_DEPENDENCIES_PATH, reference);
      }
    }

    if (this.expectedType !== null && (await fsUtils.lstat(reference)).type !== this.expectedType) {
      throw new Error(`Invalid fs entry type ("${packageLocator.reference}")`);
    }

    return {packageInfo: new PackageInfo(packageLocator), handler: new fsUtils.Handler(reference)};
  }
}
