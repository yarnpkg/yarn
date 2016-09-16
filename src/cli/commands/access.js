/* @flow */

import buildSubCommands from './_build-sub-commands.js';

export let {run, setFlags} = buildSubCommands('access', {
  async public(): Promise<void> {
    throw new Error('TODO');
  },

  async restricted(): Promise<void> {
    throw new Error('TODO');
  },

  async grant(): Promise<void> {
    throw new Error('TODO');
  },

  async revoke(): Promise<void> {
    throw new Error('TODO');
  },

  async lsPackages(): Promise<void> {
    throw new Error('TODO');
  },

  async lsCollaborators(): Promise<void> {
    throw new Error('TODO');
  },

  async edit(): Promise<void> {
    throw new Error('TODO');
  },
});
