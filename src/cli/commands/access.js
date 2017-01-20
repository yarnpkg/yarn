/* @flow */

import buildSubCommands from './_build-sub-commands.js';

export const {run, setFlags} = buildSubCommands('access', {
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
}, [
  'public [<package>]',
  'restricted [<package>]',
  'grant <read-only|read-write> <scope:team> [<package>]',
  'revoke <scope:team> [<package>]',
  'ls-packages [<user>|<scope>|<scope:team>]',
  'ls-collaborators [<package> [<user>]]',
  'edit [<package>]',
]);
