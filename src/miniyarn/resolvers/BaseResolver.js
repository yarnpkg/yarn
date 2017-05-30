import {Environment} from 'miniyarn/models/Environment';
import {PackageInfo} from 'miniyarn/models/PackageInfo';

export class BaseResolver {
  supports(packageLocator, {env}) {
    // Return true if the resolver does support the package

    throw new Error(`Unimplemented supports strategy`);
  }

  isSatisfied(packageLocator, availableLocator, {env}) {
    // Returns true if the specified package reference can be satisfied by the available package reference

    throw new Error(`Unimplemented isSatisfied strategy`);
  }

  async getCandidates(packageLocator, {env}) {
    // Return a list of every candidate pinned reference that could match the volatile reference specified in the package info
    // Note that the reference might not actually be volatile - that's something that only resolvers can know (in which case they should return a list that only contains the reference itself)

    throw new Error(`Unimplemented suggest strategy`);
  }

  async resolve(packageLocator, {fetcher, env}) {
    throw new Error(`Unimplemented resolve strategy`);
  }
}
