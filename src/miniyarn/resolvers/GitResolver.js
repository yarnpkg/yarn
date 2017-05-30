import Immutable from 'immutable';

import {PackageLocator} from 'miniyarn/models/PackageLocator';
import {PackageResolution} from 'miniyarn/models/PackageResolution';
import {BaseResolver} from 'miniyarn/resolvers/BaseResolver';
import * as miscUtils from 'miniyarn/utils/misc';

export class GitResolver extends BaseResolver {
  supports(packageRange, {env}) {
    if (!packageRange.name || !packageRange.reference) return false;

    return miscUtils.isGitReference(packageRange.reference, {env});
  }

  isSatisfied(packageRange, availableLocator, {env}) {
    return packageRange.reference === availableLocator.reference;
  }

  async getCandidates(packageRange, {env}) {
    return new Immutable.Set([packageRange.reference]);
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
}
