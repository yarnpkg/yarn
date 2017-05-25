import Immutable from 'immutable';

import {BaseLinker} from 'miniyarn/linkers/BaseLinker';
import * as yarnUtils from 'miniyarn/utils/yarn';

export class RootLinker extends BaseLinker {
  supports(packageLocator) {
    return packageLocator.reference === null;
  }

  async link(packageNode, packagePath, {linker, env, limit, tick, packageInfos, handlers}) {
    let packageInfo = packageInfos.get(packageNode.locator);

    if ([`preinstall`, `install`, `postinstall`].every(scriptName => !packageInfo.getIn([`scripts`, scriptName])))
      return await this.linkDependencies(packageNode, packagePath, {limit, linker, env, tick, packageInfos, handlers});

    return await this.linkDependencies(packageNode, packagePath, {
      limit,
      linker,
      env,
      tick,
      packageInfos,
      handlers,
    }).then(({buildTicks, build}) => {
      return {
        buildTicks: buildTicks + 1,
        build: async ({env, tick}) =>
          new Immutable.List().concat(
            await build({env, tick}),
            await this.build(packageInfo, packagePath, {env, tick}),
          ),
      };
    });
  }

  async build(packageInfo, packagePath, {env, tick}) {
    await yarnUtils.runPackageLifecycle(packageInfo, packagePath, `preinstall`);
    await yarnUtils.runPackageLifecycle(packageInfo, packagePath, `install`);
    await yarnUtils.runPackageLifecycle(packageInfo, packagePath, `postinstall`);

    tick();
  }
}
