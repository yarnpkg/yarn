import Immutable from 'immutable';

export class BaseLinker {

    supports(packageLocator) {

        // Return true if the linker does support the package

        throw new Error(`Unimplemented support strategy`);

    }

    async link(packageNode, destination, { linker, env, limit, tick, packageInfos, handlers }) {

        // Link the package to the specified location, then return an object { buildTicks, build }:
        //
        // - buildTicks is the number of ticks required for building this package
        // - build is the function to call once all packages have been built
        //
        // If buildTicks equals 0, the build function might not get called. No guarantee is made.

        throw new Error(`Unimplemented link strategy`);

    }

    async linkDependencies(packageNode, destinationPath, { linker, env, limit, tick, packageInfos, handlers }) {

        // Recursively call the linker on every dependency.
        // Because it's something so common that every linker will probably need to do it, it's better to implement it there so that there is only one implementation.

        let subLinks = await Promise.all(packageNode.dependencies.toList().map(async (dependency) => {
            return await linker.link(dependency, destinationPath, { limit, linker, env, tick, packageInfos, handlers });
        }));

        let buildTicks = subLinks.reduce((accumulator, { buildTicks }) => {
            return accumulator + buildTicks;
        }, 0);

        let build = async ({ env, tick }) => await Promise.all(subLinks.map(({ build }) => build({ env, tick }))).then(async (errorLists) => {
            return new Immutable.List().concat(... errorLists);
        });

        return { buildTicks, build };

    }

}
