# Changelog

Please add one entry in this file for each change in Yarn's behavior. Use the same format for all entries, including the third-person verb. Make sure you don't add more than one line of text to keep it clean. Thanks!

## Master

- Adds initial support for PnP on Windows

  [#6447](https://github.com/yarnpkg/yarn/pull/6447) - [**John-David Dalton**](https://twitter.com/jdalton)

- Adds a special logic to PnP for ESLint compatibility (temporary, until [eslint/eslint#10125](https://github.com/eslint/eslint/issues/10125) is fixed)

  [#6449](https://github.com/yarnpkg/yarn/pull/6449) - [**Maël Nison**](https://twitter.com/arcanis)

- Fixes `yarn run` when used together with workspaces and PnP

  [#6444](https://github.com/yarnpkg/yarn/pull/6444) - [**Maël Nison**](https://twitter.com/arcanis)

- Fixes an edge case when peer dependencies were resolved multiple levels deep (`webpack-dev-server`)

  [#6443](https://github.com/yarnpkg/yarn/pull/6443) - [**Maël Nison**](https://twitter.com/arcanis)
