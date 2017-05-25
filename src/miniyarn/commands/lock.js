import emoji from 'node-emoji';

import {recursivelyResolvePackage} from 'miniyarn/algorithms/recursivelyResolvePackage';
import {traversePackageTree} from 'miniyarn/algorithms/traversePackageTree';
import * as uiUtils from 'miniyarn/utils/ui';
import * as yarnUtils from 'miniyarn/utils/yarn';
import {fetcher} from 'miniyarn/yarn/fetcher';
import {resolver} from 'miniyarn/yarn/resolver';

export default concierge =>
  concierge.command(`lock`).describe(`Generate a new lockfile for your project`).action(async args => {
    let {packagePath, packageInfo} = await yarnUtils.openPackage(args.dir);
    let env = await yarnUtils.openEnvironment(packagePath, args);

    // --- RESOLVE

    if (!args.silent) process.stdout.write(`${emoji.get(`mag`)}  Resolving packages...\n`);

    let {packageTree, errors} = await uiUtils.trackProgress(
      {enabled: !args.silent && args.progress, total: 1, bar: `:bar :current/:total`},
      async ({tick, add}) => {
        return await recursivelyResolvePackage(packageInfo, {resolver, fetcher, env, tick, add});
      },
    );

    if (errors.size > 0) return uiUtils.reportPackageErrors(errors);

    // --- UPDATE

    await yarnUtils.updateYarnJson(packagePath, async yarnLock => {
      yarnLock.dependencies = packageTree.dependencies.toJSON();
    });

    // ---

    return await concierge.run(null, [`install`, `--internal-hide-resolve`], args);
  });
