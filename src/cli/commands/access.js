/* @flow */

import buildSubCommands from './_build-sub-commands.js';

const notYetImplemented = () => Promise.reject(new Error('This command is not implemented yet.'));

export function setFlags(commander: Object) {
  commander.description('Has not been implemented yet');
}

export const {run, hasWrapper, examples} = buildSubCommands(
  'access',
  {
    public: notYetImplemented,
    restricted: notYetImplemented,
    grant: notYetImplemented,
    revoke: notYetImplemented,
    lsPackages: notYetImplemented,
    lsCollaborators: notYetImplemented,
    edit: notYetImplemented,
  },
  [
    'WARNING: This command yet to be implemented.',
    'public [<package>]',
    'restricted [<package>]',
    'grant <read-only|read-write> <scope:team> [<package>]',
    'revoke <scope:team> [<package>]',
    'ls-packages [<user>|<scope>|<scope:team>]',
    'ls-collaborators [<package> [<user>]]',
    'edit [<package>]',
  ],
);
