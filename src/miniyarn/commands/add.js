import semver           from 'semver';

import { PackageInfo }  from 'miniyarn/models/PackageInfo';
import { PackageRange } from 'miniyarn/models/PackageRange';
import * as yarnUtils   from 'miniyarn/utils/yarn';
import { resolver }     from 'miniyarn/yarn/resolver';

export default concierge => concierge

    .command(`add <pkg-name> [... pkg-names] [-D,--dev] [-P,--peer] [-O,--optional] [-E,--exact] [-T,--tilde]`)
    .describe(`Install a package and any other package that it depends on`)

    .action(async (args) => {

        let { packagePath, packageInfo, yarnLock } = await yarnUtils.openPackage(args.dir);
        let env = await yarnUtils.openEnvironment(packagePath, args);

        let packageRanges = await Promise.all(yarnUtils.parseRangeIdentifiers([ args.pkgName, ... args.pkgNames ]).map(async (packageRange) => {

            let { packageResolution: { name, reference } } = await resolver.resolve(packageRange.update(`reference`, (reference = `*`) => reference), { env });

            if (semver.valid(reference) && !args.exact) {

                if (args.tilde) {
                    reference = `~${reference}`;
                } else {
                    reference = `^${reference}`;
                }

            }

            return new PackageRange({
                name,
                reference,
            });

        }));

        await yarnUtils.updatePackageJson(packagePath, packageJson => {

            let target = `dependencies`;

            if (args.dev)
                target = `devDependencies`;
            else if (args.peer)
                target = `peerDependencies`;
            else if (args.optional)
                target = `optionalDependencies`;

            if (!packageJson[target])
                packageJson[target] = {};

            for (let { name, reference } of packageRanges) {
                packageJson[target][name] = reference;
            }

        });

        if (yarnLock) {
            return await concierge.run(null, [ `lock` ], args);
        } else {
            return await concierge.run(null, [ `install` ], args);
        }

    })

;
