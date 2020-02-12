# Changelog

Please add one entry in this file for each change in Yarn's behavior. Use the same format for all entries, including the third-person verb. Make sure you don't add more than one line of text to keep it clean. Thanks!

## Master

- Passes arguments following `--` when running a workspace script (`yarn workspace pkg run command -- arg`)

  [#7776](https://github.com/yarnpkg/yarn/pull/7776) - [**Jeff Valore**](https://twitter.com/rally25rs)

- Prints workspace names with `yarn workspaces` (silence with `-s`)

  [#7722](https://github.com/yarnpkg/yarn/pull/7722) - [**Orta**](https://twitter.com/orta)

- Implements `yarn init --install <version>`

  [#7723](https://github.com/yarnpkg/yarn/pull/7723) - [**Maël Nison**](https://twitter.com/arcanis)
  
- Implements `yarn init -2`

  [#7862](https://github.com/yarnpkg/yarn/pull/7862) - [**Maël Nison**](https://twitter.com/arcanis)

- Implements `yarn set version <version>` as an alias for `policies set-version`

  [#7862](https://github.com/yarnpkg/yarn/pull/7862) - [**Maël Nison**](https://twitter.com/arcanis)

- Fixes an issue where the archive paths were incorrectly sanitized

  [#7831](https://github.com/yarnpkg/yarn/pull/7831) - [**Maël Nison**](https://twitter.com/arcanis)

- Allows some dots in binary names again

  [#7811](https://github.com/yarnpkg/yarn/pull/7811) - [**Valery Bugakov**](https://github.com/valerybugakov)
  
- Better error handling on `yarn set version`

  [#7848](https://github.com/yarnpkg/yarn/pull/7848) - [**Nick Olinger**](https://github.com/olingern)

## 1.19.2

- Folders like `.cache` won't be pruned from the `node_modules` after each install.

  [#7699](https://github.com/yarnpkg/yarn/pull/7699) - [**Maël Nison**](https://twitter.com/arcanis)

- Correctly installs workspace child dependencies when workspace child not symlinked to root.

  [#7289](https://github.com/yarnpkg/yarn/pull/7289) - [**Daniel Tschinder**](https://github.com/danez)

- Makes running scripts with Plug'n Play possible on node 13.

  [#7650](https://github.com/yarnpkg/yarn/pull/7650) - [**Sander Verweij**](https://github.com/sverweij)

- Change run command to check cwd/node_modules/.bin for commands. Fixes run in workspaces.

  [#7151](https://github.com/yarnpkg/yarn/pull/7151) - [**Jeff Valore**](https://twitter.com/codingwithspike)

## 1.19.1

**Important:** This release contains a cache bump. It will cause the very first install following the upgrade to take slightly more time, especially if you don't use the [Offline Mirror](https://yarnpkg.com/blog/2016/11/24/offline-mirror/) feature. After that everything will be back to normal.

- Computes the `--modules-folder` & friends paths based on the cwd.

  [#7607](https://github.com/yarnpkg/yarn/pull/7607) - [**mbpreble**](https://github.com/mbpreble)

- Stores the sha512 in the cache even when not provided by the server.

  [#7591](https://github.com/yarnpkg/yarn/pull/7591) - [**Maël Nison**](https://twitter.com/arcanis) / [#7595](https://github.com/yarnpkg/yarn/pull/7595) - [**Michael**](https://github.com/Blasz)

- Uses the right Node binary when using `yarn-path`.

  [#7592](https://github.com/yarnpkg/yarn/pull/7592) - [**Maël Nison**](https://twitter.com/arcanis)

## 1.19.0

**Important:** This release contains a cache bump. It will cause the very first install following the upgrade to take slightly more time, especially if you don't use the [Offline Mirror](https://yarnpkg.com/blog/2016/11/24/offline-mirror/) feature. After that everything will be back to normal.

- Fixes a potential vulnerability regarding how the build artifacts are stored

  Reported by [**ChALkeR**](https://github.com/ChALkeR), fixed by [**Maël Nison**](https://twitter.com/arcanis)

## 1.18.0

- Suggests using the Yarn 2 development trunk on PnP-enabled projects

  [#7512](https://github.com/yarnpkg/yarn/pull/7512) - [**Maël Nison**](https://twitter.com/arcanis)

- Preserves linked packages when calling `yarn create`

  [#7543](https://github.com/yarnpkg/yarn/pull/7543) - [**Nick McCurdy**](https://github.com/nickmccurdy)

- Fixes the offline mirror filenames when using Verdaccio

  [#7499](https://github.com/yarnpkg/yarn/pull/7499) - [**xv2**](https://github.com/xv2)

- Fixes using `link:.` to refer to the package folder

  [#7512](https://github.com/yarnpkg/yarn/pull/7512) - [**Maël Nison**](https://twitter.com/arcanis)

- Runs the `prepare` lifecycle of git dependencies even if `NODE_ENV` is set to `production`.

  [#7398](https://github.com/yarnpkg/yarn/pull/7398) - [**John Firebaugh**](https://github.com/jfirebaugh)

- Fixes the `postversion` lifecycle method not being called when using `--no-git-tag-version`.

  [#7154](https://github.com/yarnpkg/yarn/pull/7154) - [**Hampus Tågerud**](https://github.com/hampustagerud)

- Ignores potentially large vscode keys in package.json to avoid E2BIG errors.

  [#7419](https://github.com/yarnpkg/yarn/pull/7419) - [**Eric Amodio**](https://twitter.com/eamodio)

- Enforces https for the Yarn and npm registries.

  [#7393](https://github.com/yarnpkg/yarn/pull/7393) - [**Maël Nison**](https://twitter.com/arcanis)

- Adds support for reading `yarnPath` from v2-produced `.yarnrc.yml` files.

  [#7350](https://github.com/yarnpkg/yarn/pull/7350) - [**Maël Nison**](https://twitter.com/arcanis)

## 1.17.0

- Adds prereleases flags and prerelease identifier to `yarn version`.

  [#7336](https://github.com/yarnpkg/yarn/pull/7336) - [**Daniel Seijo**](https://github.com/daniseijo)

- Fixes audits when used with `yarn add` & `yarn upgrade`

  [#7326](https://github.com/yarnpkg/yarn/pull/7326) - [**David Sanders**](https://github.com/dsanders11)

- Adds support for the `--offline` flag to `yarn global add`

  [#7330](https://github.com/yarnpkg/yarn/pull/7330) - [**Francis Crick**](https://guthub.com/fcrick)

- Yarn will tolerate Yaml at parse time. Full support isn't ready yet and will only come at the next major.

  [#7300](https://github.com/yarnpkg/yarn/pull/7300) - [**Maël Nison**](https://twitter.com/arcanis)

- Fixes a bug when using the `link:` protocol with a folder that doesn't contain a `package.json`

  [#7337](https://github.com/yarnpkg/yarn/pull/7337) - [**Maël Nison**](https://twitter.com/arcanis)

## 1.16.0

- Retries downloading a package on `yarn install` when we get a ETIMEDOUT error.

  [#7163](https://github.com/yarnpkg/yarn/pull/7163) - [**Vincent Bailly**](https://github.com/VincentBailly)

- Implements `yarn audit --level [severity]` flag to filter the audit command's output.

  [#6716](https://github.com/yarnpkg/yarn/pull/6716) - [**Rogério Vicente**](https://twitter.com/rogeriopvl)

- Implements `yarn audit --groups group_name [group_name ...]`.

  [#6724](https://github.com/yarnpkg/yarn/pull/6724) - [**Tom Milligan**](https://github.com/tommilligan)

- Exposes the script environment variables to `yarn create` spawned processes.

  [#7127](https://github.com/yarnpkg/yarn/pull/7127) - [**Eli Perelman**](https://github.com/eliperelman)

- Prevents EPIPE errors from being printed.

  [#7194](https://github.com/yarnpkg/yarn/pull/7194) - [**Abhishek Reddy**](https://github.com/arbscht)

- Adds support for the npm enterprise URLs when computing the offline mirror filenames.

  [#7200](https://github.com/yarnpkg/yarn/pull/7200) - [**John Millikin**](https://john-millikin.com)

- Tweaks the lockfile parser logic to parse a few extra cases

  [#7210](https://github.com/yarnpkg/yarn/pull/7210) - [**Maël Nison**](https://twitter.com/arcanis)

## 1.15.2

The 1.15.1 doesn't exist due to a release hiccup.

- Reverts a behavior causing boggus interactions between PowerShell and `yarn global`

  [#6954](https://github.com/yarnpkg/yarn/pull/6954) - [**briman0094**](https://github.com/briman0094)

- Fixes a bug where non-zero exit codes were converted to a generic 1 when running `yarn run`

  [#6926](https://github.com/yarnpkg/yarn/pull/6926) - [**Kyle Fang**](https://github.com/zhigang1992)

- Fixes production / development reporting when running `yarn audit`

  [#6970](https://github.com/yarnpkg/yarn/pull/6970) - [**Adam Richardson**](https://github.com/as3richa)

## 1.15.0

- Removes `--scripts-prepend-node-path` as Yarn's default behavior makes this obsolete

  [#7057](https://github.com/yarnpkg/yarn/pull/7057/files) - [**Jason Grout**](https://github.com/jasongrout)

- Fixes the advisory link printed by `yarn audit`

  [#7091](https://github.com/yarnpkg/yarn/pull/7091) - [**Jakob Krigovsky**](https://github.com/sonicdoe)

- Fixes `npm_config_` environment variable parsing to support those prefixed with underscore (ex: `_auth`)

  [#7070](https://github.com/yarnpkg/yarn/pull/7070) - [**Nicholas Boll**](https://github.com/NicholasBoll)

- Fixes yarn `upgrade --latest` for dependencies using `>` or `>=` range specifier

  [#7080](https://github.com/yarnpkg/yarn/pull/7080) - [**Xukai Wu**](https://github.com/shilcare)

- Fixes `--modules-folder` handling in several places (ex: `yarn check` now respects `--modules-folder`)

  [#6850](https://github.com/yarnpkg/yarn/pull/6850) - [**Jeff Valore**](https://twitter.com/codingwithspike)

- Removes `rootModuleFolders` (internal variable which wasn't used anywhere)

  [#6846](https://github.com/yarnpkg/yarn/pull/6846) - [**Jeff Valore**](https://twitter.com/codingwithspike)

- Adds support for setting `global-folder` from `.yarnrc` files

  [#7056](https://github.com/yarnpkg/yarn/pull/7056) - [**Hsiao-nan Cheung**](https://github.com/niheaven)

- Makes `yarn version` cancellable via ctrl-c or empty string

  [#7064](https://github.com/yarnpkg/yarn/pull/7064) - [**Olle Lauri Boström**](https://github.com/ollelauribostrom)

- Adds support for `yarn policies set-version berry`

  [#7041](https://github.com/yarnpkg/yarn/pull/7041/files) - [**Maël Nison**](https://twitter.com/arcanis)

- Fixes yarn `upgrade --scope` when using exotic (github) dependencies

  [#7017](https://github.com/yarnpkg/yarn/pull/7017) - [**Jeff Valore**](https://twitter.com/codingwithspike)

- Fixes occasionally mismatching upper/lowecases of drive letters in win32 pnp check

  [#7007](https://github.com/yarnpkg/yarn/pull/7007) - [**Christoph Werner**](https://github.com/codepunkt)

- Fixes the error reporting for non-HTTP network errors (such as invalid certificates)

  [#6968](https://github.com/yarnpkg/yarn/pull/6968) - [**Chih-Hsuan Yen**](https://github.com/yan12125)

- Changes the location where the `--require ./.pnp.js` flag gets added into `NODE_OPTIONS`: now at the front (bis)

  [#6951](https://github.com/yarnpkg/yarn/pull/6951) - [**John-David Dalton**](https://twitter.com/jdalton)

- Packages won't be auto-unplugged anymore if `ignore-scripts` is set in the yarnrc file

  [#6983](https://github.com/yarnpkg/yarn/pull/6983) - [**Micha Reiser**](https://github.com/MichaReiser)

- Enables displaying Emojis on [Terminus](https://github.com/Eugeny/terminus) by default

  [#7093](https://github.com/yarnpkg/yarn/pull/7093) - [**David Refoua**](https://github.com/DRSDavidSoft)

- Run the engines check before executing `run` scripts.

  [#7013](https://github.com/yarnpkg/yarn/issues/7013) - [**Eloy Durán**](https://github.com/alloy)

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
