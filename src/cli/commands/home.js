/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import NpmRegistry from '../../registries/npm-registry.js';
import parsePackageName from '../../util/parse-package-name.js';
import * as fs from '../../util/fs.js';
import opn from 'opn';

export function setFlags(commander: Object) {
  commander.usage('homeFail [flags]');
  commander.option('--browser [BROWSER]', 'Use BROWSER instead of system default');
}

export async function run(
 config: Config,
 reporter: Reporter,
 flags: Object,
 args: Array<string>,
): Promise<void> {
  // default to local directory
  if (args.length < 1) {
    args = ['.'];
  }

  for (const name of args) {
    let result = null;
    if (name === '.') {
      result = await fs.readJson('package.json');
    } else {
      const packageInput = NpmRegistry.escapeName(name);
      const {name: parsedName} = parsePackageName(packageInput);
      if (!parsedName) {
        reporter.error(reporter.lang('invalidPackageName'));
        continue;
      }
      result = await config.registries.npm.request(parsedName);
      if (!result) {
        reporter.error(reporter.lang('homeFail'));
        continue;
      }
    }
    if (!result.homepage) {
      reporter.error(reporter.lang('homeNoPackage'));
    } else {
      opn(result.homepage, {app: flags.browser});
    }
  }
}
