/* @flow */

import {DEPENDENCY_TYPES} from '../../constants.js';
import {FILE_PROTOCOL_PREFIX} from '../../resolvers/exotics/file-resolver.js';
import {LINK_PROTOCOL_PREFIX} from '../../resolvers/exotics/link-resolver.js';
import invariant from 'invariant';

const path = require('path');

export default function(info: Object, moduleLoc: string, lockfileFolder: string) {
  // It won't work if we don't yet know what's the folder we'll use as root. It's not a
  // big deal tho, because it only happens when trying to figure out the root, and we
  // don't need to know the dependencies / devDependencies at this time.
  if (!lockfileFolder) {
    return;
  }

  for (const dependencyType of DEPENDENCY_TYPES) {
    const dependencies = info[dependencyType];
    if (!dependencies) {
      continue;
    }

    for (const name of Object.keys(dependencies)) {
      let value = dependencies[name];

      if (path.isAbsolute(value)) {
        value = FILE_PROTOCOL_PREFIX + value;
      }

      let prefix;
      if (value.startsWith(FILE_PROTOCOL_PREFIX)) {
        prefix = FILE_PROTOCOL_PREFIX;
      } else if (value.startsWith(LINK_PROTOCOL_PREFIX)) {
        prefix = LINK_PROTOCOL_PREFIX;
      } else {
        continue;
      }
      invariant(prefix, 'prefix is definitely defined here');

      const unprefixed = value.substr(prefix.length);
      const hasPathPrefix = /^\.(\/|$)/.test(unprefixed);

      const absoluteTarget = path.resolve(lockfileFolder, moduleLoc, unprefixed);
      let relativeTarget = path.relative(lockfileFolder, absoluteTarget) || '.';

      if (absoluteTarget === lockfileFolder) {
        relativeTarget = '.';
      } else if (hasPathPrefix) {
        // TODO: This logic should be removed during the next major bump
        // If the original value was using the "./" prefix, then we output a similar path.
        // We need to do this because otherwise it would cause problems with already existing
        // lockfile, which would see some of their entries being unrecognized.
        relativeTarget = relativeTarget.replace(/^(?!\.{0,2}\/)/, `./`);
      }

      dependencies[name] = prefix + relativeTarget.replace(/\\/g, '/');
    }
  }
}
