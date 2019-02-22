# Changelog

Please add one entry in this file for each change in Yarn's behavior. Use the same format for all entries, including the third-person verb. Make sure you don't add more than one line of text to keep it clean. Thanks!

## Master

- Allow `global-folder` to be set in `.yarnrc`.

  [#7056](https://github.com/yarnpkg/yarn/pull/7056) - [**Hsiao-nan Cheung**](https://github.com/niheaven)

- Fix yarn `upgrade --scope` when using exotic (github) dependencies.

  [#7017](https://github.com/yarnpkg/yarn/pull/7017) - [**Jeff Valore**](https://twitter.com/codingwithspike)

- Fixes occasionally mismatching upper/lowecases of drive letters in win32 pnp check

  [#7007](https://github.com/yarnpkg/yarn/pull/7007) - [**Christoph Werner**](https://github.com/codepunkt)

- Fixes the error reporting for non-HTTP network errors (such as invalid certificates)

  [#6968](https://github.com/yarnpkg/yarn/pull/6968) - [**Chih-Hsuan Yen**](https://github.com/yan12125)

- Changes the location where the `--require ./.pnp.js` flag gets added into `NODE_OPTIONS`: now at the front (bis)

  [#6951](https://github.com/yarnpkg/yarn/pull/6951) - [**John-David Dalton**](https://twitter.com/jdalton)

- Packages won't be auto-unplugged anymore if `ignore-scripts` is set in the yarnrc file

  [#6983](https://github.com/yarnpkg/yarn/pull/6983) - [**Micha Reiser**](https://github.com/MichaReiser)

## 1.14.0

- Improves PnP compatibility with Node 6

  [#6871](https://github.com/yarnpkg/yarn/pull/6871) - [**Robert Jackson**](https://github.com/rwjblue)

- Fixes PnP detection with workspaces (`installConfig` is now read at the top-level)

  [#6878](https://github.com/yarnpkg/yarn/pull/6878) - [**Maël Nison**](https://twitter.com/arcanis)

- Fixes an interaction between `yarn pack` and bundled dependencies

  [#6908](https://github.com/yarnpkg/yarn/pull/6908) - [**Travis Hoover**](https://twitter.com/thoov)

- Adds support for `GITHUB_TOKEN` in `yarn policies set-version`

  [#6912](https://github.com/yarnpkg/yarn/pull/6912) - [**Billy Vong**](https://github.com/billyvg)

- Fixes an issue where `resolve` would forward an incomplete basedir to the PnP hook

  [#6882](https://github.com/yarnpkg/yarn/pull/6882) - [**Zoran Regvart**](https://github.com/zregvart)

- Fixes the command that `yarn unlink` recommends to run as a followup (now `yarn install --force`)

  [#6931](https://github.com/yarnpkg/yarn/pull/6931) - [**Justin Sacbibit**](https://github.com/justinsacbibit)

- Changes the location where the `--require ./.pnp.js` flag gets added into `NODE_OPTIONS`: now at the front

  [#6942](https://github.com/yarnpkg/yarn/pull/6942) - [**John-David Dalton**](https://twitter.com/jdalton)

- Fixes a bug where `os` and `platform` requirements weren't properly checked when `engines` was missing

  [#6976](https://github.com/yarnpkg/yarn/pull/6976) - [**Micha Reiser**](https://github.com/MichaReiser)

## 1.13.0

- Implements a new `package.json` field: `peerDependenciesMeta`

  [#6671](https://github.com/yarnpkg/yarn/pull/6671) - [**Maël Nison**](https://twitter.com/arcanis)

- Adds an `optional` settings to `peerDependenciesMeta` to silence missing peer dependency warnings

  [#6671](https://github.com/yarnpkg/yarn/pull/6671) - [**Maël Nison**](https://twitter.com/arcanis)

- Implements `yarn policies set-version [range]`. Check [the documentation]() for usage & tips.

  [#6673](https://github.com/yarnpkg/yarn/pull/6673) - [**Maël Nison**](https://twitter.com/arcanis)

- Fixes a resolution issue when a package had an invalid `main` entry

  [#6682](https://github.com/yarnpkg/yarn/pull/6682) - [**Maël Nison**](https://twitter.com/arcanis)

- Decreases the size of the generated `$PATH` environment variable for a better Windows support

  [#6683](https://github.com/yarnpkg/yarn/issues/6683) - [**Rowan Lonsdale**](https://github.com/hWorblehat)

- Fixes postinstall scripts for third-party packages when they were referencing a binary from their own dependencies

  [#6712](https://github.com/yarnpkg/yarn/pull/6712) - [**Maël Nison**](https://twitter.com/arcanis)

- Fixes yarn audit exit code overflow

  [#6748](https://github.com/yarnpkg/yarn/issues/6748) - [**Andrey Vetlugin**](https://github.com/antrew)

- Stops automatically unplugging packages with postinstall script when running under `--ignore-scripts`

  [#6820](https://github.com/yarnpkg/yarn/pull/6820) - [**Maël Nison**](https://twitter.com/arcanis)

- Adds transparent support for the [`resolve`](https://github.com/browserify/resolve) package when using Plug'n'Play

  [#6816](https://github.com/yarnpkg/yarn/pull/6816) - [**Maël Nison**](https://twitter.com/arcanis)

- Properly reports the error codes when the npm registry throws 500's

  [#6817](https://github.com/yarnpkg/yarn/pull/6817) - [**Maël Nison**](https://twitter.com/arcanis)

## 1.12.3

**Important:** This release contains a cache bump. It will cause the very first install following the upgrade to take slightly more time, especially if you don't use the [Offline Mirror](https://yarnpkg.com/blog/2016/11/24/offline-mirror/) feature. After that everything will be back to normal.

- Fixes an issue with `yarn audit` when using workspaces

  [#6625](https://github.com/yarnpkg/yarn/pull/6639) - [**Jeff Valore**](https://twitter.com/codingwithspike)

- Uses `NODE_OPTIONS` to instruct Node to load the PnP hook, instead of raw CLI arguments

  **Caveat:** This change might cause issues for PnP users having a space inside their cwd (cf [nodejs/node#24065](https://github.com/nodejs/node/pull/24065))

  [#6479](https://github.com/yarnpkg/yarn/pull/6629) - [**Maël Nison**](https://twitter.com/arcanis)

- Fixes Gulp when used with Plug'n'Play

  [#6623](https://github.com/yarnpkg/yarn/pull/6623) - [**Maël Nison**](https://twitter.com/arcanis)

- Fixes an issue with `yarn audit` when the root package was missing a name

  [#6611](https://github.com/yarnpkg/yarn/pull/6611) - [**Jack Zhao**](https://github.com/bugzpodder)

- Fixes an issue with `yarn audit` when a package was depending on an empty range

  [#6611](https://github.com/yarnpkg/yarn/pull/6611) - [**Jack Zhao**](https://github.com/bugzpodder)

- Fixes an issue with how symlinks are setup into the cache on Windows

  [#6621](https://github.com/yarnpkg/yarn/pull/6621) - [**Yoad Snapir**](https://github.com/yoadsn)

- Upgrades `inquirer`, fixing `upgrade-interactive` for users using both Node 10 and Windows

  [#6635](https://github.com/yarnpkg/yarn/pull/6635) - [**Philipp Feigl**](https://github.com/pfeigl)

- Exposes the path to the PnP file using `require.resolve('pnpapi')`

  [#6643](https://github.com/yarnpkg/yarn/pull/6643) - [**Maël Nison**](https://twitter.com/arcanis)

## 1.12.2

This release doesn't actually exists and was caused by a quirk in our systems.

## 1.12.1

- Ensures the engine check is ran before showing the UI for `upgrade-interactive`

  [#6536](https://github.com/yarnpkg/yarn/pull/6536) - [**Orta Therox**](https://github.com/orta)

- Restores Node v4 support by downgrading `cli-table3`

  [#6535](https://github.com/yarnpkg/yarn/pull/6535) - [**Mark Stacey**](https://github.com/Gudahtt)

- Prevents infinite loop when parsing corrupted lockfiles with unterminated strings

  [#4965](https://github.com/yarnpkg/yarn/pull/4965) - [**Ryan Hendrickson**](https://github.com/rhendric)

- Environment variables now have to **start** with `YARN_` (instead of just contain it) to be considered

  [#6518](https://github.com/yarnpkg/yarn/pull/6518) - [**Michael Gmelin**](https://blog.grem.de)

- Fixes the `extensions` option when used by `resolveRequest`

  [#6479](https://github.com/yarnpkg/yarn/pull/6479) - [**Maël Nison**](https://twitter.com/arcanis)

- Fixes handling of empty string entries for `bin` in package.json

  [#6515](https://github.com/yarnpkg/yarn/pull/6515) - [**Ryan Burrows**](https://github.com/rhburrows)

- Adds support for basic auth for registries with paths, such as artifactory

  [#5322](https://github.com/yarnpkg/yarn/pull/5322) - [**Karolis Narkevicius**](https://twitter.com/KidkArolis)

- Adds 2FA (Two Factor Authentication) support to publish & alike

  [#6555](https://github.com/yarnpkg/yarn/pull/6555) - [**Krzysztof Zbudniewek**](https://github.com/neonowy)

- Fixes how the `files` property is interpreted to bring it in line with npm

  [#6562](https://github.com/yarnpkg/yarn/pull/6562) - [**Bertrand Marron**](https://github.com/tusbar)

- Fixes Yarn invocations on Darwin when the `yarn` binary was symlinked

  [#6568](https://github.com/yarnpkg/yarn/pull/6568) - [**Hidde Boomsma**](https://github.com/hboomsma)

- Fixes `require.resolve` when used together with the `paths` option

  [#6565](https://github.com/yarnpkg/yarn/pull/6565) - [**Maël Nison**](https://twitter.com/arcanis)

## 1.12.0

- Adds initial support for PnP on Windows

  [#6447](https://github.com/yarnpkg/yarn/pull/6447) - [**John-David Dalton**](https://twitter.com/jdalton)

- Adds `yarn audit` (and the `--audit` flag for all installs)

  [#6409](https://github.com/yarnpkg/yarn/pull/6409) - [**Jeff Valore**](https://github.com/rally25rs)

- Adds a special logic to PnP for ESLint compatibility (temporary, until [eslint/eslint#10125](https://github.com/eslint/eslint/issues/10125) is fixed)

  [#6449](https://github.com/yarnpkg/yarn/pull/6449) - [**Maël Nison**](https://twitter.com/arcanis)

- Makes the PnP hook inject a `process.versions.pnp` variable when setup (equals to `VERSIONS.std`)

  [#6464](https://github.com/yarnpkg/yarn/pull/6464) - [**Maël Nison**](https://twitter.com/arcanis)

- Disables by default (configurable) the automatic migration of the `integrity` field. **It will be re-enabled in 2.0.**

  [#6465](https://github.com/yarnpkg/yarn/pull/6465) - [**Maël Nison**](https://twitter.com/arcanis)

- Fixes the display name of the faulty package when the NPM registry returns corrupted data

  [#6455](https://github.com/yarnpkg/yarn/pull/6455) - [**Grey Baker**](https://github.com/greysteil)

- Prevents crashes when running `yarn outdated` and the NPM registry forgets to return the `latest` tag

  [#6454](https://github.com/yarnpkg/yarn/pull/6454) - [**mad-mike**](https://github.com/mad-mike)

- Fixes `yarn run` when used together with workspaces and PnP

  [#6444](https://github.com/yarnpkg/yarn/pull/6444) - [**Maël Nison**](https://twitter.com/arcanis)

- Fixes an edge case when peer dependencies were resolved multiple levels deep (`webpack-dev-server`)

  [#6443](https://github.com/yarnpkg/yarn/pull/6443) - [**Maël Nison**](https://twitter.com/arcanis)
