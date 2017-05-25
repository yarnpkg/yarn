import {BaseResolver} from 'miniyarn/resolvers/BaseResolver';

export class BaseMultiResolver extends BaseResolver {
  resolvers = [];

  add(resolver) {
    this.resolvers.push(resolver);

    return this;
  }

  supports(packageLocator, {env}) {
    return this.resolvers.some(resolver => {
      return resolver.supports(packageLocator, {env});
    });
  }

  isSatisfied(packageLocator, availableLocator, {env}) {
    let candidateResolvers = this.resolvers.filter(resolver => {
      return resolver.supports(packageLocator, {env}) && resolver.supports(availableLocator, {env});
    });

    if (candidateResolvers.length === 0) throw new Error(`No resolver offered to handle these packages`);

    if (candidateResolvers.length > 1) throw new Error(`Multiple resolvers offered to resolve a same package`);

    return candidateResolvers[0].isSatisfied(packageLocator, availableLocator, {env});
  }

  async getCandidates(packageLocator, {env}) {
    let candidateResolvers = this.resolvers.filter(resolver => {
      return resolver.supports(packageLocator, {env});
    });

    if (candidateResolvers.length === 0) throw new Error(`No resolver offered to handle this package`);

    if (candidateResolvers.length > 1) throw new Error(`Multiple resolvers offered to resolve a same package`);

    return await candidateResolvers[0].getCandidates(packageLocator, {env});
  }

  async resolve(packageLocator, {fetcher, env}) {
    let candidateResolvers = this.resolvers.filter(resolver => {
      return resolver.supports(packageLocator, {env});
    });

    if (candidateResolvers.length === 0) throw new Error(`No resolver offered to handle this package`);

    if (candidateResolvers.length > 1) throw new Error(`Multiple resolvers offered to resolve a same package`);

    return await candidateResolvers[0].resolve(packageLocator, {fetcher, env});
  }
}
