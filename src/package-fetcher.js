import promiseLimit from 'promise-limit';

import {Environment} from 'miniyarn/models/Environment';
import {PackageLocator} from 'miniyarn/models/PackageLocator';
import {Manifest} from 'miniyarn/models/Manifest';
import * as fsUtils from 'miniyarn/utils/fs';
import {fetcher} from 'miniyarn/yarn/fetcher';

export async function fetch(pkgs: Array<Manifest>, config: Config): Promise<Array<Manifest>> {
  let tick = config.reporter.progress(pkgs.length);

  let env = new Environment({
    CACHE_PATH: `/tmp/yarn+miniyarn/cache`,
    MIRROR_PATH: config.getOfflineMirrorPath(`.`),
    RELATIVE_DEPENDENCIES_PATH: config.cwd,
  });

  let limit = promiseLimit(5);

  return await Promise.all(
    pkgs.map(manifest => limit(() => {
      let dest = config.generateHardModulePath(manifest._reference);

      let name = manifest.name;
      let reference = manifest._reference.remote.reference;

      // If it looks like a file path "foo.tgz", remove the ambiguity ("./foo.tgz")
      if (reference && reference.match(/^[^:]*?\.tgz$/))
        reference = reference.replace(/^(?!\.{0,2}\/)/, `./`);

      let locator = new PackageLocator({
        name: name,
        reference: reference,
      });

      return fetcher.fetch(locator, {fetcher, env}).then(async ({packageInfo, handler}) => {
        await fsUtils.rm(dest);
        await handler.steal(dest);

        tick(manifest.name);

        manifest.dependencies = packageInfo.dependencies.toJS();
        manifest.devDependencies = packageInfo.devDependencies.toJS();
        manifest.peerDependencies = packageInfo.peerDependencies.toJS();
        manifest.bundledDependencies = packageInfo.bundledDependencies.toJS();

        await fsUtils.writeJson(`${dest}/.yarn-metadata.json`, {
            artifacts: [],
            remote: {},
            registry: null,
            hash: null,
        });

        return manifest;
      });
    })),
  );
}
