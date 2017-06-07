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

      // The following hacks should be applied by the resolvers rather than the fetchers.
      // Some code has already been written, but we haven't got around merging it yet - hopefully it will come in good time.

      if (reference) // Transform old github archive urls to use the new endpoint
        reference = reference.replace(/^https:\/\/github\.com\/([^\/]+\/[^\/]+)\/tarball\/([^\/]+)$/, 'https://github.com/$1/archive/$2.tar.gz');

      if (reference) // Same thing for codeload urls
        reference = reference.replace(/^https:\/\/codeload\.github\.com\/([^\/]+\/[^\/]+)\/tar\.gz\/([^\/]+)$/, 'https://github.com/$1/archive/$2.tar.gz');

      if (reference) // If it looks like a file path "foo.tgz", remove the ambiguity ("./foo.tgz")
        reference = reference.replace(/^(?!\.{0,2}\/)([^:]*\.tgz)$/, './$1');

      let locator = new PackageLocator({
        name: name,
        reference: reference,
      });

      return fetcher.fetch(locator, {fetcher, env}).then(async ({packageInfo, handler}) => {
        await fsUtils.rm(dest);
        await handler.steal(dest);

        tick(manifest.name);

        manifest.bin = packageInfo.bin.toJS();
        manifest.scripts = packageInfo.scripts.toJS();

        manifest.dependencies = packageInfo.dependencies.map(({ reference }) => reference).toJS();
        manifest.devDependencies = packageInfo.devDependencies.map(({ reference }) => reference).toJS();
        manifest.peerDependencies = packageInfo.peerDependencies.map(({ reference }) => reference).toJS();
        manifest.bundledDependencies = packageInfo.bundledDependencies.map(({ reference }) => reference).toJS();

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
