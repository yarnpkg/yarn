# Changelog

Please add one entry in this file for each change in Yarn's behavior. Use the same format for all entries, including the third-person verb. Make sure you don't add more than one line of text to keep it clean. Thanks!

## Master

- Adds initial support for PnP on Windows

  [#6447](https://github.com/yarnpkg/yarn/pull/6447) - [**John-David Dalton**](https://twitter.com/jdalton)

- Adds `yarn audit` (and the `--audit` flag for all installs)

  [#6409](https://github.com/yarnpkg/yarn/pull/6409) - [**Jeff Valore**](https://github.com/rally25rs)

- Adds a special logic to PnP for ESLint compatibility (temporary, until [eslint/eslint#10125](https://github.com/eslint/eslint/issues/10125) is fixed)

  [#6449](https://github.com/yarnpkg/yarn/pull/6449) - [**Maël Nison**](https://twitter.com/arcanis)

- Makes the PnP hook inject a `process.versions.pnp` variable when setup (equals to `VERSIONS.std`)

  [#6464](https://github.com/yarnpkg/yarn/pull/6464) - [**Maël Nison**](https://twitter.com/arcanis)

- Fixes the display name of the faulty package when the NPM registry returns corrupted data

  [#6455](https://github.com/yarnpkg/yarn/pull/6455) - [**Grey Baker**](https://github.com/greysteil)

- Prevents crashes when running `yarn outdated` and the NPM registry forgets to return the `latest` tag

  [#6454](https://github.com/yarnpkg/yarn/pull/6454) - [**mad-mike**](https://github.com/mad-mike)

- Fixes `yarn run` when used together with workspaces and PnP

  [#6444](https://github.com/yarnpkg/yarn/pull/6444) - [**Maël Nison**](https://twitter.com/arcanis)

- Fixes an edge case when peer dependencies were resolved multiple levels deep (`webpack-dev-server`)

  [#6443](https://github.com/yarnpkg/yarn/pull/6443) - [**Maël Nison**](https://twitter.com/arcanis)
