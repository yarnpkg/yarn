import Immutable                     from 'immutable';
import Joi                           from 'joi';
import treeify                       from 'treeify';

import { getPackageTreeLocators }    from 'miniyarn/algorithms/getPackageTreeLocators';
import { recursivelyResolvePackage } from 'miniyarn/algorithms/recursivelyResolvePackage';
import { stringifyPackageTree }      from 'miniyarn/algorithms/stringifyPackageTree';
import { traversePackageTree }       from 'miniyarn/algorithms/traversePackageTree';
import { PackageNode }               from 'miniyarn/models/PackageNode';
import * as miscUtils                from 'miniyarn/utils/misc';
import * as streamUtils              from 'miniyarn/utils/stream';
import * as uiUtils                  from 'miniyarn/utils/ui';
import * as yarnUtils                from 'miniyarn/utils/yarn';
import { fetcher }                   from 'miniyarn/yarn/fetcher';
import { resolver }                  from 'miniyarn/yarn/resolver';

let formatters = {

    tree: async ({ packageTree, treeSize, filter }) => {

        function exportDependencies(packageNode) {

            let locatorIdentifier = packageNode === packageTree ? `.` : yarnUtils.getLocatorIdentifier(packageNode.locator);

            let dependencyTrees = packageNode.dependencies.sortBy(dependency => {
                return dependency.name;
            }).toArray().map(dependency => {
                return exportDependencies(dependency);
            }).filter(dependencyTree => {
                return dependencyTree;
            });

            if (packageNode === packageTree || dependencyTrees.length > 0 || filter(packageNode.locator))
                return { [locatorIdentifier]: Object.assign({}, ... dependencyTrees) };

            return null;

        }

        return `${treeify.asTree(exportDependencies(packageTree))}\n`;

    },

    list: async ({ packageTree, treeSize, filter }) => {

        let locatorIdentifiers = (await getPackageTreeLocators(packageTree, { includeRoot: false })).filter(packageLocator => {
            return filter(packageLocator);
        }).map(packageLocator => {
            return yarnUtils.getLocatorIdentifier(packageLocator);
        }).sortBy(locatorIdentifier => {
            return locatorIdentifier;
        });

        return locatorIdentifiers.map(locatorIdentifier => {
            return `${locatorIdentifier}\n`;
        }).join(``);

    },

    uniq: async ({ packageTree, treeSize }) => {

        let locatorSetGroups = (await getPackageTreeLocators(packageTree, { includeRoot: false })).filter(packageLocator => {
            return filter(packageLocator);
        }).groupBy(packageLocator => {
            return packageLocator.name;
        }).groupBy(locatorSet => {
            return locatorSet.size;
        }).sortBy((locatorSetGroup, count) => {
            return -count;
        });

        return locatorSetGroups.map((locatorSetGroup, count) => {
            return locatorSetGroup.sortBy((locatorSet, packageName) => packageName).map((locatorSet, packageName) => {
                return `${locatorSet.size} ${packageName} ${locatorSet.map(locator => locator.reference).join(` `)}\n`;
            }).join(``);
        }).join(``);

    }

};

export default concierge => concierge

    .command(`resolve [--no-lock] [--production] [--name PATTERN] [--format FORMAT] [--no-pager]`)
    .describe(`Resolve your package dependencies`)
    .validate(`format`, Joi.string().default(`tree`).valid(... Reflect.ownKeys(formatters)))

    .action(async (args) => {

        let { packagePath, packageInfo, yarnLock } = await yarnUtils.openPackage(args.dir);
        let env = await yarnUtils.openEnvironment(packagePath, args);

        let { packageTree, treeSize, errors = new Immutable.Map() } = await uiUtils.trackProgress({ enabled: !args.silent && args.progress, total: 1, bar: `:bar :current/:total` }, async ({ tick, add }) => {

            if (!args.lock || !yarnLock || !yarnLock.dependencies)
                return await recursivelyResolvePackage(packageInfo, { resolver, fetcher, env, production: args.production, tick, add });

            let packageTree = new PackageNode(packageInfo.locator).merge({
                dependencies: new PackageNode({ dependencies: yarnLock.dependencies }).dependencies,
            });

            let treeSize = 1;

            await traversePackageTree(packageTree, packageNode => {

                treeSize += packageNode.dependencies.size;
                add(packageNode.dependencies.size);

                tick();

            });

            return { packageTree };

        });

        let data = await formatters[args.format]({ packageTree, treeSize, filter: packageLocator => {

            if (args.name && !miscUtils.stringPatternMatch(packageLocator.name, [ args.name ]))
                return false;

            return true;

        } });

        if (errors.size > 0)
            return uiUtils.reportPackageErrors(errors);

        if (args.pager)
            await streamUtils.pager(data);
        else
            process.stdout.write(data);

        return 0;

    })

;
