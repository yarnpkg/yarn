import {BaseFetcher} from 'miniyarn/fetchers/BaseFetcher';
import * as yarnUtils from 'miniyarn/utils/yarn';

export class BaseMultiFetcher extends BaseFetcher {
  fetchers = [];

  add(fetcher) {
    this.fetchers.push(fetcher);

    return this;
  }

  supports(packageLocator, {env}) {
    return this.fetchers.some(fetcher => {
      return fetcher.supports(packageLocator, {env});
    });
  }

  async fetch(packageLocator, {env}) {
    let candidateFetchers = this.fetchers.filter(fetcher => {
      return fetcher.supports(packageLocator, {env});
    });

    if (candidateFetchers.length === 0) throw new Error(`No fetcher offered to handle this package (${yarnUtils.getLocatorIdentifier(packageLocator)})`);

    return candidateFetchers[0].fetch(packageLocator, {env});
  }
}
