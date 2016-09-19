/* @flow */

import buildSubCommands from './_build-sub-commands.js';

export let {run, setFlags} = buildSubCommands('access', {
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
});
