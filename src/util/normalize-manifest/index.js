/* @flow */

import type {Manifest} from '../../types.js';
import type Config from '../../config.js';
import validate from './validate.js';
import fix from './fix.js';

let path = require('path');

export default async function (
  info: Object,
  moduleLoc: string,
  config: Config,
  isRoot: boolean,
): Promise<Manifest> {
  await fix(info, moduleLoc, config.reporter, config.looseSemver);

  // create human readable name
  let {name, version} = info;
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

  try {
    validate(info, isRoot, config.reporter, warn);
  } catch (err) {
    if (human) {
      err.message = `${human}: ${err.message}`;
    }
    throw err;
  }

  return info;
}
