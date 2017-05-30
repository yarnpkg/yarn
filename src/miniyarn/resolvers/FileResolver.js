import Immutable from 'immutable';

import {PackageLocator} from 'miniyarn/models/PackageLocator';
import {PackageResolution} from 'miniyarn/models/PackageResolution';
import {BaseResolver} from 'miniyarn/resolvers/BaseResolver';
import * as pathUtils from 'miniyarn/utils/path';

export class FileResolver extends BaseResolver {
  supports(packageRange, {env}) {
    if (!packageRange.reference) return false;

    return pathUtils.isPathForSure(packageRange.reference);
  }

  isSatisfied(packageRange, availableLocator, {env}) {
    return this.normalize(packageRange.reference) === availableLocator.reference;
  }

  async getCandidates(packageRange, {env}) {
    return new Immutable.Set([this.normalize(packageRange.reference)]);
  }

  async resolve(packageRange, {fetcher, env}) {
    let {packageInfo} = await fetcher.fetch(
      new PackageLocator({name: packageRange.name, reference: packageRange.reference}),
      {env},
    );

    return {
      packageResolution: new PackageResolution({
        name: packageRange.name,
        reference: packageRange.reference,
        dependencies: packageInfo.dependencies,
      }),
    };
  }

  normalize(packageReference) {
    return pathUtils.makeExplicit(pathUtils.normalize(packageReference));
  }
}
