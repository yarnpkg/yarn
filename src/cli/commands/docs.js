/* @flow */

import opn from 'opn';
import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import handlePackageName from '../../util/handle-package-name.js';
import parsePackageName from '../../util/parse-package-name.js';

function openPackageDocs(
  name: string,
  packageInfo,
  app?: string): Promise<string> {
  const options = {};
  let url = packageInfo.homepage;
  if (!url) {
    url = `https://www.npmjs.org/package/${name}`;
  }
  if (app) {
    options.app = app;
  }
  opn(url, options, false);
  return Promise.resolve(url);
}

export function setFlags(commander: Object) {
  commander.usage('docs [packages ...] [flags]');
  commander.option(
    '-a, --app <app>',
    'the app that is used to open websites.' +
    ' Defaults: macOS="open", Windows="start", Others="xdg-open"');
}

export async function run(
 config: Config,
 reporter: Reporter,
 flags: Object,
 args: Array<string>,
): Promise<void> {
  const packageNames = args.slice();
  if (packageNames.length === 0) {
    packageNames.push('.');
  }
  for (let i = 0; i < packageNames.length; i++) {
    const packageName = await handlePackageName(packageNames[i], config);
    if (!packageName) {
      reporter.error(reporter.lang('packageHasNoName', packageName));
      return;
    }
    const {name} = parsePackageName(packageName);
    const packageInfo = await config.registries.npm.request(name);
    if (!packageInfo) {
      reporter.error(reporter.lang('infoFail'));
      return;
    } else {
      const url = await openPackageDocs(name, packageInfo, flags.app);
      reporter.log(reporter.lang('openedDocs', name, url));
    }
  }
}
