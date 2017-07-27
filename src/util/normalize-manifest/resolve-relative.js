import {FILE_PROTOCOL_PREFIX} from '../../resolvers/exotics/file-resolver.js';
import {LINK_PROTOCOL_PREFIX} from '../../resolvers/exotics/link-resolver.js';

const path = require('path');

export default function(info: Object, moduleLoc: string, lockfileFolder: string): void {
  // It won't work if we don't yet know what's the folder we'll use as root. It's not a
  // big deal tho, because it only happens when trying to figure out the root, and we
  // don't need to know the dependencies / devDependencies at this time.
  if (!lockfileFolder) {
    return;
  }

  for (const hint of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    if (!info[hint]) {
      continue;
    }

    for (const name of Object.keys(info[hint])) {
      let value = info[hint][name];

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
          // If the original value was using the "./" prefix, then we output a similar path.
          // We need to do this because otherwise it would cause problems with already existing
          // lockfile, which would see some of their entries being unrecognized.
          relativeTarget = relativeTarget.replace(/^(?!\.{0,2}\/)/, `./`);
        }

        info[hint][name] = prefix + relativeTarget;
      }
    }
  }
}
