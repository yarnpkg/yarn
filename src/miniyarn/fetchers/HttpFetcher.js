import invariant from 'invariant';
import Url from 'url';

import {BaseFetcher} from 'miniyarn/fetchers/BaseFetcher';
import {PackageInfo} from 'miniyarn/models/PackageInfo';
import * as archiveUtils from 'miniyarn/utils/archive';
import * as fsUtils from 'miniyarn/utils/fs';
import * as httpUtils from 'miniyarn/utils/http';
import * as miscUtils from 'miniyarn/utils/misc';
import * as yarnUtils from 'miniyarn/utils/yarn';

export class HttpFetcher extends BaseFetcher {
  constructor({pathPattern = null} = {}) {
    super();

    this.pathPattern = pathPattern;
  }

  supports(packageLocator, {env, ... rest}) {
    if (!packageLocator.reference) {
      return false;
    }

    let parse = Url.parse(packageLocator.reference);

    if (![`http:`, `https:`].includes(parse.protocol)) {
      return false;
    }

    if (!parse.host || !parse.path) {
      return false;
    }

    if (parse.path.endsWith(`.git`)) {
      return false;
    }

    if (this.pathPattern && !miscUtils.filePatternMatch(parse.path, this.pathPattern)) {
      return false;
    }

    return true;
  }

  async fetch(packageLocator, {env, registry, ... rest}) {
    invariant(packageLocator.name, `This package locator should have a name`);
    invariant(packageLocator.reference, `This package locator should have a reference`);

    let archivePath = await fsUtils.createTemporaryFile();
    let archiveHandler = new fsUtils.Handler(archivePath, {temporary: true});

    let outputStream = await fsUtils.createFileWriter(archivePath);

    await registry.request(packageLocator.reference, { process: (req, resolve, reject) => {
      req.pipe(outputStream);
      req.on(`error`, reject);
      req.on(`end`, resolve);
    } });

    await outputStream.promise;

    return {packageInfo: new PackageInfo(packageLocator), handler: archiveHandler};
  }
}
