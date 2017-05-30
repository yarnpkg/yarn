import {BaseResolver} from 'miniyarn/resolvers/BaseResolver';

export function makeTransformResolver(Resolver, {supports, transformReference}) {
  return class TransformResolver extends BaseResolver {
    constructor(options) {
      super();

      this.resolver = new Resolver(options);
    }

    supports(packageRange, {env}) {
      return supports(packageRange, {env});
    }

    isSatisfied(packageRange, availableLocator, {env}) {
      let transformedRange = packageRange.merge({reference: transformReference(packageRange, {env})});

      if (!this.resolver.supports(transformedRange))
        throw new Error(`The transformed locator isn't supported by the target resolver`);

      return this.resolver.isSatisfied(transformedRange, availableLocator, {env});
    }

    async getCandidates(packageRange, {env}) {
      let transformedRange = packageRange.merge({reference: transformReference(packageRange, {env})});

      if (!this.resolver.supports(transformedRange))
        throw new Error(`The transformed locator isn't supported by the target resolver`);

      return await this.resolver.getCandidates(transformedRange, {env});
    }

    async resolve(packageRange, {fetcher, env}) {
      let transformedRange = packageRange.merge({reference: transformReference(packageRange, {env})});

      if (!this.resolver.supports(transformedRange))
        throw new Error(`The transformed locator isn't supported by the target resolver`);

      return await this.resolver.resolve(transformedRange, {fetcher, env});
    }
  };
}
