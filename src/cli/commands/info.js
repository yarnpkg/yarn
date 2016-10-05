/* @flow */

import type {Reporter} from '../../reporters/index.js';
import type Config from '../../config.js';
import NpmRegistry from '../../registries/npm-registry.js';

const semver = require('semver');
const PKG_INPUT = /(^\S[^\s@]+)(?:@(\S+))?$/;

function clean(object: any): any {
  if (Array.isArray(object)) {
    const result = [];
    object.forEach((item) => {
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

export async function run(
 config: Config,
 reporter: Reporter,
 flags: Object,
 args: Array<string>,
): Promise<void> {
  if (args.length !== 1 && args.length !== 2) {
    return;
  }

  const packageInput = NpmRegistry.escapeName(args.shift());
  const field = args.shift();

  const parts = PKG_INPUT.exec(packageInput);
  const packageName = parts[1];
  const packageVersion = parts[2];

  let result = await config.registries.npm.request(packageName);
  if (!result) {
    reporter.error(reporter.lang('infoFail'));
    return;
  }

  result = clean(result);

  const versions = result.versions;
  // $FlowFixMe
  result.versions = Object.keys(versions).sort(semver.compareLoose);
  result.version = packageVersion || result.versions[result.versions.length - 1];
  result = Object.assign(result, versions[result.version]);

  // Readmes can be long so exclude them unless explicitly asked for.
  if (field !== 'readme') {
    delete result.readme;
  }

  reporter.inspect(field ? result[field] : result);
}
