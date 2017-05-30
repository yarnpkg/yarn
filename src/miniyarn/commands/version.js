import semver from 'semver';

import * as uiUtils from 'miniyarn/utils/ui';
import * as yarnUtils from 'miniyarn/utils/yarn';

export default concierge =>
  concierge
    .command(`version [--set VERSION] [--bump LEVEL] [-i,--interactive]`)
    .describe(`Print or bump the version number`)
    .action(async args => {
      let {packagePath, packageInfo} = await yarnUtils.openPackageEnvironment(args.dir);

      if (!args.set && !args.bump && !args.interactive) {
        if (!packageInfo.version) return uiUtils.reportError(new Error(`Package has no version`));

        if (!semver.valid(packageInfo.version))
          return uiUtils.reportError(new Error(`Invalid version (is "${packageInfo.version}")`));

        process.stdout.write(`${packageInfo.version}\n`);

        return 0;
      } else {
        let nextVersion;

        if (args.set) nextVersion = args.set;
        else if (args.bump) nextVersion = semver.inc(packageInfo.version, args.bump);
        else if (args.interactive) nextVersion = await askVersion(packageInfo.version);

        if (nextVersion === null) return 0;

        await yarnUtils.updatePackageJson(packagePath, packageJson => {
          packageJson.version = nextVersion;
        });

        return 0;
      }
    });

async function askVersion(version) {
  if (version != null) {
    return await uiUtils.askOne({
      default: 0,
      choices: [`patch`, `minor`, `major`].map(level => {
        let nextVersion = semver.inc(version, level);

        return {
          value: nextVersion,
          short: nextVersion,

          name: `${nextVersion} (${level})`,
        };
      }),
    });
  } else {
    return await uiUtils.askOne({
      default: 0,
      choices: [{value: `0.0.1`, short: `0.0.1`, name: `0.0.1`}, {value: `1.0.0`, short: `1.0.0`, name: `1.0.0`}],
    });
  }
}
