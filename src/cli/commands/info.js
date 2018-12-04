/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import NpmRegistry from '../../registries/npm-registry.js';
import parsePackageName from '../../util/parse-package-name.js';
const semver = require('semver');

function clean(object: any): any {
  if (Array.isArray(object)) {
    const result = [];
    object.forEach(item => {
      item = clean(item);
      if (item) {
        result.push(item);
      }
    });
    return result;
  } else if (typeof object === 'object') {
    const result = {};
    for (const key in object) {
      if (key.startsWith('_')) {
        continue;
      }

      const item = clean(object[key]);
      if (item) {
        result[key] = item;
      }
    }
    return result;
  } else if (object) {
    return object;
  } else {
    return null;
  }
}

export function setFlags(commander: Object) {
  commander.description('Shows information about a package.');
}

export function hasWrapper(commander: Object, args: Array<string>): boolean {
  return true;
}

export async function run(config: Config, reporter: Reporter, flags: Object, args: Array<string>): Promise<void> {
  if (args.length > 2) {
    reporter.error(reporter.lang('tooManyArguments', 2));
    return;
  }

  let packageName = args.shift() || '.';

  // Handle the case when we are referencing a local package.
  if (packageName === '.') {
    packageName = (await config.readRootManifest()).name;
  }

  const packageInput = NpmRegistry.escapeName(packageName);
  const {name, version} = parsePackageName(packageInput);

  let result;
  try {
    result = await config.registries.npm.request(name, {unfiltered: true});
  } catch (e) {
    reporter.error(reporter.lang('infoFail'));
    return;
  }
  if (!result) {
    reporter.error(reporter.lang('infoFail'));
    return;
  }

  result = clean(result);

  const versions = result.versions;
  // $FlowFixMe
  result.versions = Object.keys(versions).sort(semver.compareLoose);
  result.version = version || result['dist-tags'].latest;
  result = Object.assign(result, versions[result.version]);

  const fieldPath = args.shift();
  const fields = fieldPath ? fieldPath.split('.') : [];

  // Readmes can be long so exclude them unless explicitly asked for.
  if (fields[0] !== 'readme') {
    delete result.readme;
  }

  result = fields.reduce((prev, cur) => prev && prev[cur], result);
  reporter.inspect(result);
}
