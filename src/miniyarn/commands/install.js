import { flags }                     from '@manaflair/concierge';
import Immutable                     from 'immutable';
import emoji                         from 'node-emoji';
import Path                          from 'path';
import promiseLimit                  from 'promise-limit';

import { fetchAllPackages }          from 'miniyarn/algorithms/fetchAllPackages';
import { getPackageTreeLocators }    from 'miniyarn/algorithms/getPackageTreeLocators';
import { recursivelyResolvePackage } from 'miniyarn/algorithms/recursivelyResolvePackage';
import { traversePackageTree }       from 'miniyarn/algorithms/traversePackageTree';
import { PackageNode }               from 'miniyarn/models/PackageNode';
import * as uiUtils                  from 'miniyarn/utils/ui';
import * as yarnUtils                from 'miniyarn/utils/yarn';
import { fetcher }                   from 'miniyarn/yarn/fetcher';
import { linker }                    from 'miniyarn/yarn/linker';
import { resolver }                  from 'miniyarn/yarn/resolver';

export default concierge => concierge

    .command(`install [-f,--force] [--force-volatiles] [--production] [--no-lock] [--internal-hide-resolve]`)
    .describe(`Install all dependencies for the current project`)
    .flag(flags.DEFAULT_COMMAND)

    .action(async (args) => {

        let { packagePath, packageInfo, yarnLock } = await yarnUtils.openPackage(args.dir);
        let env = await yarnUtils.openEnvironment(packagePath, args);

        // --- RESOLVE

        if (!args.silent && !args.internalHideResolve) {
            if (args.lock && yarnLock && yarnLock.dependencies) {
                process.stdout.write(`${emoji.get(`mag`)}  Resolving packages from lockfile...\n`);
            } else {
                process.stdout.write(`${emoji.get(`mag`)}  Resolving packages...\n`);
            }
        }

        let { packageTree, treeSize, errors: resolveErrors = new Immutable.Map() } = await uiUtils.trackProgress({ enabled: !args.silent && args.progress && !args.internalHideResolve, total: 1, bar: `:bar :current/:total` }, async ({ tick, add }) => {

            if (!args.lock || !yarnLock || !yarnLock.dependencies)
                return await recursivelyResolvePackage(packageInfo, { resolver, fetcher, env, production: args.production, tick, add });

            let packageTree = new PackageNode(packageInfo.locator).merge({
                dependencies: new PackageNode({ dependencies: yarnLock.dependencies }).dependencies,
            });

            let treeSize = 1;

            await traversePackageTree(packageTree, packageInfo => {

                treeSize += packageInfo.dependencies.size;
                add(packageInfo.dependencies.size);

                tick();

            });

            return { packageTree, treeSize };

        });

        if (resolveErrors.size > 0)
            return uiUtils.reportPackageErrors(resolveErrors);

        // --- FETCH

        let packageLocators = await getPackageTreeLocators(packageTree, { includeRoot: false });

        if (!args.silent)
            process.stdout.write(`${emoji.get(`truck`)}  Fetching ${packageLocators.size} package(s)...\n`);

        let { packageInfos, handlers, errors: fetchErrors } = await uiUtils.trackProgress({ enabled: !args.silent && args.progress, total: packageLocators.size, bar: `:bar :percent` }, async ({ tick }) => {
            return await fetchAllPackages(packageLocators, { limit: promiseLimit(5), fetcher, env, tick });
        });

        // We need to register the root packageInfo ourselves, since it won't be part of the packageLocators (because its reference is null, so it would be impossible to fetch it)
        packageInfos = packageInfos.set(packageInfo.locator, packageInfo);

        if (fetchErrors.size > 0)
            return uiUtils.reportPackageErrors(fetchErrors);

        // --- LINK

        if (!args.silent)
            process.stdout.write(`${emoji.get(`link`)}  Linking those packages together...\n`);

        let { buildTicks, build } = await uiUtils.trackProgress({ enabled: !args.silent && args.progress, total: treeSize - 1, bar: `:bar :percent` }, async ({ tick }) => {
            return await linker.link(packageTree, packagePath, { limit: promiseLimit(5), linker, env, tick, packageInfos, handlers });
        });

        // --- BUILD

        if (buildTicks > 0) {

            if (!args.silent)
                process.stdout.write(`${emoji.get(`ice_cream`)}  Building ${buildTicks} fresh package(s)...\n`);

            await uiUtils.trackProgress({ enabled: !args.silent && args.progress, total: buildTicks, bar: `:bar :percent` }, async ({ tick }) => {
                await build({ env, tick });
            });

        }

        // ---

        if (!args.silent)
            process.stdout.write(`${emoji.get(`star`)}  Everything's done!\n`);

        return 0;

    })

;
