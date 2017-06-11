import {BaseFetcher} from 'miniyarn/fetchers/BaseFetcher';

export function makeTransformFetcher(Fetcher, {supports, transformReference}) {
  return class TransformFetcher extends BaseFetcher {
    constructor(options) {
      super();

      this.fetcher = new Fetcher(options);
    }

    supports(packageLocator, {env, ... rest}) {
      return supports(packageLocator, {env, ... rest});
    }

    async fetch(packageLocator, {env, ... rest}) {
      let transformedLocator = packageLocator.merge({reference: transformReference(packageLocator, {env, ... rest})});

      if (!this.fetcher.supports(transformedLocator, {env, ... rest}))
        throw new Error(`The transformed locator isn't supported by the target fetcher`);

      return await this.fetcher.fetch(transformedLocator, {env, ... rest});
    }
  };
}
