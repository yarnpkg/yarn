/* @flow */

import buildSubCommands from './_build-sub-commands.js';

export const {run, setFlags, hasWrapper, examples} = buildSubCommands(
  'access',
  {
    public(): Promise<void> {
      return Promise.reject(new Error('TODO'));
    },

    restricted(): Promise<void> {
      return Promise.reject(new Error('TODO'));
    },

    grant(): Promise<void> {
      return Promise.reject(new Error('TODO'));
    },

    revoke(): Promise<void> {
      return Promise.reject(new Error('TODO'));
    },

    lsPackages(): Promise<void> {
      return Promise.reject(new Error('TODO'));
    },

    lsCollaborators(): Promise<void> {
      return Promise.reject(new Error('TODO'));
    },

    edit(): Promise<void> {
      return Promise.reject(new Error('TODO'));
    },
  },
  [
    'access public [<package>]',
    'access restricted [<package>]',
    'access grant <read-only|read-write> <scope:team> [<package>]',
    'access revoke <scope:team> [<package>]',
    'access ls-packages [<user>|<scope>|<scope:team>]',
    'access ls-collaborators [<package> [<user>]]',
    'access edit [<package>]',
  ],
);
