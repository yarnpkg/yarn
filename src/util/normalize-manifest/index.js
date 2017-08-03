/* @flow */

import type {Manifest} from '../../types.js';
import type Config from '../../config.js';
import resolveRelative from './resolve-relative.js';
import validate from './validate.js';
import fix from './fix.js';

const path = require('path');

export default (async function(info: Object, moduleLoc: string, config: Config, isRoot: boolean): Promise<Manifest> {
  // create human readable name
  const {name, version} = info;
  let human: ?string;
  if (typeof name === 'string') {
    human = name;
  }
  if (human && typeof version === 'string' && version) {
    human += `@${version}`;
  }
  if (isRoot && info._loc) {
    human = path.relative(config.cwd, info._loc);
  }

  function warn(msg: string) {
    if (human) {
      msg = `${human}: ${msg}`;
    }
    config.reporter.warn(msg);
  }

  await fix(info, moduleLoc, config.reporter, warn, config.looseSemver);
  resolveRelative(info, moduleLoc, config.lockfileFolder);

  if (config.cwd === config.globalFolder) {
    return info;
  }

  try {
    validate(info, isRoot, config.reporter, warn);
  } catch (err) {
    if (human) {
      err.message = `${human}: ${err.message}`;
    }
    throw err;
  }

  return info;
});
