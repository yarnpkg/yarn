<p align="center">
  <a href="https://yarnpkg.io/">
    <img alt="Yarn" src="https://github.com/yarnpkg/yarn/blob/master/assets/logo.png?raw=true" width="546">
  </a>
</p>

<p align="center">
  alternate npm and bower client focused on determinism, security and performance.
</p>

<p align="center">
  <a href="https://travis-ci.org/yarnpkg/yarn"><img alt="Travis Status" src="https://travis-ci.com/yarnpkg/yarn.svg?token=DxqWAqRqs3zWAF8EhBHy"></a>
  <a href="https://circleci.com/gh/yarnpkg/yarn"><img alt="Circle Status" src="https://circleci.com/gh/yarnpkg/yarn.svg?style=svg&circle-token=5f0a78473b0f440afb218bf2b82323cc6b3cb43f"></a>
  <a href="https://ci.appveyor.com/project/yarnpkg/yarn/branch/master"><img alt="Appveyor Status" src="https://ci.appveyor.com/api/projects/status/rhcdj4980ccy7su3/branch/master?svg=true"></a>
</p>

---

Yarn is a package manager for the npm and bower registries with a few specific focuses.

**Determinism:** Based around a version lockfile which ensures that operations on the
dependency graph can be easily transitioned. We check module directories and verify their
integrity to ensure `kpm install` always produces the same file structure.

**Security:** Strict guarantees are placed around package installation. You have control over
whether lifecycle scripts are executed for packages and package hashes are stored in the
lockfile to ensure you get the same package each time.

**Performance:** We're always performing operations such as package resolving and fetching. This
ensures little idle time and maximum resource utilization.

## Features

 - Compatible with npm and bower. Supports mixing registries.
 - Offline mode which resolves registry queries against local cache.
 - Pretty, readable and minimal CLI output.
 - Ability to rename packages and have multiple root level packages of the same name but different versions.
 - Efficient and reliable package cache.
 - Deterministic package installation.
 - Stable public JS API with logging abstracted for consumption via build tools.
 - Mutex to ensure multiple running CLI instances don't collide and pollute each other.
 - Ability to restrict licenses of installed modules and ways to output licensing information.*
 - Concise lockfile format. No whitespace, ordered keys to ensure minimal changes and noise.
 - Vendored tarball dependencies.
 - Ability to manually resolve version conflicts so only a single version per package exists. (Bower style)
 - Efficient resolution, fetching and storage of git repos. We use hosted git APIs when using GitHub and Bitbucket for performance.
 - Caching of build artifacts produced by install scripts.
 - More emojis. 🐈

## Usage (while in development)

```sh
$ git clone git@github.com:yarnpkg/yarn.git yarn
$ cd yarn
$ npm install
$ npm run build
$ npm link
# go into some random directory
$ mkdir node_modules
$ kpm install your-package
```

## Prior art

Yarn wouldn't exist if it wasn't for excellent prior art. Followed are projects which Yarn has
been inspired by:

 - [Bundler](https://github.com/bundler/bundler)
 - [Cargo](https://github.com/rust-lang/cargo)
 - [npm](https://github.com/npm/npm)
