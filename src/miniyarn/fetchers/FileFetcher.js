import {BaseFetcher} from 'miniyarn/fetchers/BaseFetcher';
import {PackageInfo} from 'miniyarn/models/PackageInfo';
import * as fsUtils from 'miniyarn/utils/fs';
import * as miscUtils from 'miniyarn/utils/misc';
import * as pathUtils from 'miniyarn/utils/path';

export class FileFetcher extends BaseFetcher {
  constructor({pathPattern = null} = {}) {
    super();

    this.pathPattern = pathPattern;
  }

  supports(packageLocator, {env}) {
    if (!packageLocator.reference) return false;

    if (!pathUtils.isPathForSure(packageLocator.reference)) return false;

    if (this.pathPattern && !miscUtils.filePatternMatch(packageLocator.reference, this.pathPattern)) return false;

    return true;
  }

  async fetch(packageLocator, {env}) {
    return {packageInfo: new PackageInfo(packageLocator), handler: new fsUtils.Handler(packageLocator.reference)};
  }
}
