import {BaseLinker} from 'miniyarn/linkers/BaseLinker';

export class BaseMultiLinker extends BaseLinker {
  linkers = [];

  add(linker) {
    this.linkers.push(linker);

    return this;
  }

  supports(packageLocator) {
    return this.linkers.some(linker => {
      return linker.supports(packageLocator);
    });
  }

  async link(packageNode, destination, {linker, env, limit, tick, packageInfos, handlers}) {
    let candidateLinkers = this.linkers.filter(linker => {
      return linker.supports(packageNode.locator);
    });

    if (candidateLinkers.length === 0) throw new Error(`No linker offered to handle this package`);

    if (candidateLinkers.length > 1) throw new Error(`Multiple linkers offered to link a same package`);

    return await candidateLinkers[0].link(packageNode, destination, {linker, env, limit, tick, packageInfos, handlers});
  }
}
