import Immutable       from 'immutable';
import invariant       from 'invariant';
import Path            from 'path';

import { BaseLinker }  from 'miniyarn/linkers/BaseLinker';
import { PackageInfo } from 'miniyarn/models/PackageInfo';
import * as fsUtils    from 'miniyarn/utils/fs';
import * as yarnUtils  from 'miniyarn/utils/yarn';

export class YarnLinker extends BaseLinker {

    supports(packageLocator) {

        return packageLocator.reference != null;

    }

    async link(packageNode, parentPath, { linker, env, limit, tick, packageInfos, handlers }) {

        invariant(packageNode.name, `This package node should have a name`);
        invariant(packageNode.reference, `This package node should have a reference`);

        let packageInfo = packageInfos.get(packageNode.locator);
        let handler = handlers.get(packageNode.locator);

        let nodeModulesPath = `${parentPath}/node_modules`;

        let sourcePath = handler.get();
        let packagePath = `${nodeModulesPath}/${packageNode.name}`;

        // We tries to be smart, and to avoid installing packages that have already been installed. We need to check for the existence of the atomic file, because the install might have been aborted, and the folder might be corrupted
        let needsUpdate = !await fsUtils.exists(`${packagePath}/${env.ATOMIC_FILENAME}`) || (await fsUtils.readJson(`${packagePath}/${env.INFO_FILENAME}`)).reference !== packageNode.reference;
        let hasBuildScripts = [ `preinstall`, `install`, `postinstall` ].some(scriptName => packageInfo.getIn([ `scripts`, scriptName ]));

        needsUpdate && await limit(async () => {

            // We remove the atomic file before any other so that if the next rimraf is aborted, the process will resume at the next install
            await fsUtils.rm(`${packagePath}/${env.ATOMIC_FILENAME}`);
            await fsUtils.rm(`${packagePath}`);

            // We make sure not to copy the atomic file accidentally (in case the install fails before lifecycle hooks run), and we don't need the archive either
            await fsUtils.cp(sourcePath, packagePath, { filter: [ `!/${env.ATOMIC_FILENAME}`, `!/${env.ARCHIVE_FILENAME}` ] });

            // Install the package symlinks into the binary directory
            for (let [ name, file ] of packageInfo.bin.entries())
                await fsUtils.ensureSymlink(Path.resolve(`${packagePath}/`, file), `${nodeModulesPath}/.bin/${name}`);

            // Iterate over the bundled dependencies of the current package, and add them to its binary directory
            for (let packageName of packageInfo.bundledDependencies) {
                for (let [ name, file ] of new PackageInfo(await fsUtils.readJson(`${packagePath}/node_modules/${packageName}/package.json`)).bin.entries()) {
                    await fsUtils.ensureSymlink(Path.resolve(`${packagePath}/node_modules/${packageName}/`, file), `${packagePath}/node_modules/.bin/${name}`);
                }
            }

        });

        tick();

        let { buildTicks, build } = await this.linkDependencies(packageNode, packagePath, { limit, linker, env, tick, packageInfos, handlers });

        if (hasBuildScripts && (needsUpdate || buildTicks > 0))
            return { buildTicks: buildTicks + 1, build: async ({ env, tick }) => new Immutable.List().concat(await build({ env, tick }), await this.build(packageInfo, packagePath, { env, tick })) };

        await this.finalize(packagePath, { env });

        return { buildTicks, build };

    }

    async build(packageInfo, packagePath, { env, tick }) {

        await yarnUtils.runPackageLifecycle(packageInfo, packagePath, `preinstall`);
        await yarnUtils.runPackageLifecycle(packageInfo, packagePath, `install`);
        await yarnUtils.runPackageLifecycle(packageInfo, packagePath, `postinstall`);

        await this.finalize(packagePath, { env });

        tick();

    }

    async finalize(packagePath, { env }) {

        await yarnUtils.writeAtomicFile(`${packagePath}/${env.ATOMIC_FILENAME}`);

    }

}
