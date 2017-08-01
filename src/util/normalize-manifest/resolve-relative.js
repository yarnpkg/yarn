/* @flow */

import {DEPENDENCY_TYPES} from '../../constants.js';
import {FILE_PROTOCOL_PREFIX} from '../../resolvers/exotics/file-resolver.js';
import {LINK_PROTOCOL_PREFIX} from '../../resolvers/exotics/link-resolver.js';

const path = require('path');

export default function(info: Object, moduleLoc: string, lockfileFolder: string) {
  // It won't work if we don't yet know what's the folder we'll use as root. It's not a
  // big deal tho, because it only happens when trying to figure out the root, and we
  // don't need to know the dependencies / devDependencies at this time.
  if (!lockfileFolder) {
    return;
  }

  for (const dependencyType of DEPENDENCY_TYPES) {
    if (!info[dependencyType]) {
      continue;
    }

    for (const name of Object.keys(info[dependencyType])) {
      let value = info[dependencyType][name];

      if (path.isAbsolute(value)) {
        value = FILE_PROTOCOL_PREFIX + value;
      }

      let prefix;

      if (value.indexOf(FILE_PROTOCOL_PREFIX) === 0) {
        prefix = FILE_PROTOCOL_PREFIX;
      } else if (value.indexOf(LINK_PROTOCOL_PREFIX) === 0) {
        prefix = LINK_PROTOCOL_PREFIX;
      }

      if (prefix) {
        const unprefixed = value.substr(prefix.length);
        const hasPrefix = /^\.(\/|$)/.test(unprefixed);

        const absoluteTarget = path.resolve(lockfileFolder, moduleLoc, unprefixed);
        let relativeTarget = path.relative(lockfileFolder, absoluteTarget) || '.';

        if (hasPrefix) {
          // TODO: This logic should be removed during the next major bump
          // If the original value was using the "./" prefix, then we output a similar path.
          // We need to do this because otherwise it would cause problems with already existing
          // lockfile, which would see some of their entries being unrecognized.
          relativeTarget = relativeTarget.replace(/^(?!\.{0,2}\/)/, `./`);
        }

        info[dependencyType][name] = prefix + relativeTarget.replace(/\\/g, '/');
      }
    }
  }
}
