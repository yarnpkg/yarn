import {Environment} from 'miniyarn/models/Environment';
import {PackageLocator} from 'miniyarn/models/PackageLocator';
import {Manifest} from 'miniyarn/models/Manifest';
import * as fsUtils from 'miniyarn/utils/fs';
import {fetcher} from 'miniyarn/yarn/fetcher';

export async function fetch(pkgs: Array<Manifest>, config: Config): Promise<Array<Manifest>> {
  let tick = config.reporter.progress(pkgs.length);

  let env = new Environment({
    CACHE_PATH: `/tmp/yarn+miniyarn/cache`,
    MIRROR_PATH: `/tmp/yarn+miniyarn/mirror`,
  });

  return await Promise.all(
    pkgs.map(manifest => {
      let dest = config.generateHardModulePath(manifest._reference);

      let locator = new PackageLocator({
        name: manifest.name,
        reference: manifest._reference.remote.reference,
      });

      return fetcher.fetch(locator, {fetcher, env}).then(async ({packageInfo, handler}) => {
        await fsUtils.rm(dest);
        await fsUtils.mv(await handler.steal(), dest);

        tick(manifest.name);

        manifest.dependencies = packageInfo.dependencies.toJS();
        manifest.devDependencies = packageInfo.devDependencies.toJS();
        manifest.peerDependencies = packageInfo.peerDependencies.toJS();
        manifest.bundledDependencies = packageInfo.bundledDependencies.toJS();

        await fsUtils.writeFile(`${dest}/.yarn-metadata.json`, JSON.stringify({
            artifacts: [],
            remote: {},
            registry: null,
            hash: null,
        }));

        return manifest;
      });
    }),
  );
}
