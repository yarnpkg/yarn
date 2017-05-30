import {UsageError, flags} from '@manaflair/concierge';

import * as yarnUtils from 'miniyarn/utils/yarn';

export default concierge =>
  concierge
    .command(`run <script> [... args]`)
    .describe(`Run a package script into the project directory`)
    .flag(flags.PROXY_COMMAND)
    .action(async args => {
      let {packagePath, packageInfo} = await yarnUtils.openPackage(args.dir);

      await yarnUtils.runPackageLifecycle(packageInfo, packagePath, args.script, {args: args.args, stdio: `inherit`});
    });
