import { UsageError } from '@manaflair/concierge';

import * as yarnUtils from 'miniyarn/utils/yarn';

export default concierge => concierge

    .command(`remove <pkg-name> [... pkg-names]`)
    .alias(`rm`)
    .describe(`Uninstall a package, removing it from your project`)

    .action(async (args) => {

        let { packagePath } = await yarnUtils.openPackage(args.dir);

        let packageRanges = yarnUtils.parseRangeIdentifiers([ args.pkgName, ... args.pkgNames ]);

        if (packageRanges.some(packageRange => packageRange.reference !== undefined))
            throw new UsageError(`This command cannot remove specific versions of a dependency`);

        await yarnUtils.updatePackageJson(packagePath, packageJson => {

            for (let target of [ `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies` ]) {

                if (!packageJson[target])
                    continue;

                for (let packageLocator of packageRanges) {
                    delete packageJson[target][packageLocator.name];
                }

            }

        });

        if (yarnLock) {
            return await concierge.run(null, [ `lock` ], args);
        } else {
            return await concierge.run(null, [ `install` ], args);
        }

    })

;
