<p align="center">
  <a href="https://yarnpkg.com/">
    <img alt="Yarn" src="https://github.com/yarnpkg/assets/blob/master/yarn-kitten-full.png?raw=true" width="546">
  </a>
</p>

<p align="center">
  Fast, reliable, and secure dependency management.
</p>

<p align="center">
  <a href="https://travis-ci.org/yarnpkg/yarn"><img alt="Travis Status" src="https://travis-ci.org/yarnpkg/yarn.svg"></a>
  <a href="https://circleci.com/gh/yarnpkg/yarn"><img alt="Circle Status" src="https://circleci.com/gh/yarnpkg/yarn.svg?style=shield&circle-token=5f0a78473b0f440afb218bf2b82323cc6b3cb43f"></a>
  <a href="https://ci.appveyor.com/project/kittens/yarn/branch/master"><img alt="Appveyor Status" src="https://ci.appveyor.com/api/projects/status/0xdv8chwe2kmk463?svg=true"></a>
  <a href="https://discord.gg/yarnpkg"><img alt="Discord Chat" src="https://discordapp.com/api/guilds/226791405589233664/widget.png"></a>
</p>

---

# Esy (Yarn fork for native compilation with sandboxing)

Implementation of `package.json` for compiled languages 
-------------------------------------

## Features

- Directory based projects (like `package.json`).
- Parallel builds.
- Clean environment builds for reproducibility.
- Global build cache shared across all projects.
- File system sandboxing to prevent builds from mutating locations they don't
  own.
- Environment variable configuration and management.
- Allows symlink workflows for local development (by enforcing out-of-source
  builds).
- Run commands in sandbox quickly `esy any command`.
- Eject entire entire build to parallel `Makefile`
  - Build dependency graph without network access.
  - Build dependency graph where `node` is not installed.


## Install

`npm install -g "git://github.com/reasonml/esy.git#beta-v0.0.2"`

## Workflow

`esy` provides one global command (`esy`) which manages compiled, local
`package.json` projects.

The typical workflow is to `cd` into a directory that contains a `package.json`
file, and then perform operations on that project.

|Command            | Meaning
|-----------------  |-----------------------------------------------------------------------------------------------------------------------
|`esy`              | Print the environment that the package in the current directory is built within.
|`esy install`      | Installs `package.json` packages, but with the ability to bridge to other non-npm based package managers.
|`esy build`        | Builds everything that needs to be built, caches results. Builds according to each package's `"esy": {}` entry `package.json`. Before building each package, the environment is scrubbed clean then created according to dependencies.
|`esy build-shell`  | Drops into a shell with environment matching your package's build environment.
|`esy shell`        | The same as `esy build-shell`, but creates a "relaxed" environment - meaning it also inherits your existing shell.
|`esy build-eject ` | Creates `node_modules/.cache/esy/Makefile`, which is what `esy build` normally runs.
|`esy any cmd`      | Executes `any command here` as if you had executed it inside of `esy shell`.


One interesting thing about `esy` is that even the normal `esy build` command
ejects to pure makefile, before building. This is a convenient way to ensure
that `esy build-eject` always matches the behavior of `esy build`.

 
## Try An Example

```
# Make sure esy is installed
npm install -g "git://github.com/reasonml/esy.git#beta-v0.0.2"

# Clone the example esy project
git clone git@github.com:esy-ocaml/esy-ocaml-project.git

cd esy-ocaml-project

# Now install and build it
esy install
esy build

# Now run some commands inside the environment
esy                 # What's the project environment look like?
esy which ocamlopt  # Run a command within the environment
```

## Enjoy The Cache

The previous example may have taken 10 minutes to build, but with `esy`'s
cache, the second time will be instant.

```
rm -rf node_modules
esy install
esy build
```

`esy`'s cache is package-granular and takes into account anything that could
influence the build. If you create another project with 90% of the same
dependencies, there's a good chance that 90% of the build is performed
instantly (pulled from cache).


## Configuring Your `package.json`

`esy` knows how to build your package and its dependencies by looking at the
`"esy"` config object in your `package.json`.

```
{
  "name": "example-package",
  "version": "1.0.0",

  "esy": {
    "build": [
      "make --buildDest=$cur__target_dir",
      "cp $cur__target_dir/bin/* $cur__install/bin/"
    ],
    "exportedEnv": {
      "PATH": {
        "val": "$PATH:$cur__install/bin",
        "scope": "global"
      }
    },
  },

  "dependencies": {
    "AnotherPackage": "1.0.0"
  }
}
```

#### Build Steps

The `build` entry in the `esy` config object is an array of build steps executed in sequence.

There are many build in environment variables that are automatically available
to you in your build steps. Many of these have been adapted from other compiled
package managers such as OPAM or Cargo. They are detailed in the
[PJC](https://github.com/jordwalke/PackageJsonForCompilers) spec which `esy`
attempts to adhere to.

For example, the environment variables `$cur__target_dir` is an environment
variable set up which points to the location that `esy` expects you to place
your build artifacts into. `$cur__install` represents a directory that you are
expected to install your final artifacts into.

A typical configuration might build the artifacts into the special build
destination, and then copy the important artifacts into the final installation
location (which is the cache).

### Exported Environment

In the example above, the configuration also *exports* an environment variable,
specifically, the `PATH` environment variable, so that other packages that
depend on this package can *see* those binary artifacts.

Because exporting the `PATH` to contain the `$cur__install/bin` directory is so
common, `esy` performs this automatically. It's still up to you to export any
other environment variables.

> Note: Right now, packages that depend on your package have their `PATH`
> augmented with *your* package's `$cur__install/bin` - with `scope: global`.
> This should be improved - it shouldn't be globally visible, it should only be
> visible to packages that have an immediate dependency on your package.

> Note: You could imagine implementing npm's `bin` feature on top of this - and
> then some.


## Optional Config Variables

```
{
  ...
  "esy": {
    ...
    "buildsInSource": true
  }
}
```

- `buildsInSource` should be set to true if your package does not respect out
  of source builds. `esy build` will keep packages honest using OS-level file
  system sandboxing, warning when a package writes to its own source directory
  without marking itself `buildsInSource:true`. For packages that build in
  source, their package contents are copied to a defensive copy before
  building.


## Making Esy Awesome

- [Make `esy` the standard editor environment
  config](https://github.com/jordwalke/esy/issues/70).
- [`esy` Dashboard / Assistant](https://github.com/jordwalke/esy/issues/71)
- [Render to ninja / Powershell](https://github.com/jordwalke/esy/issues/72)

# Contributing


### Directory Layout

Here's a general overview of the directory layout created by various `esy`
commands.

##### Global Cache

When building projects, most globally cached artifacts are stored in `~/.esy/store`.

    ~/.esy/
     ├─ OtherStuffHereToo.md
     └─ store/
        ├── _build
        ├── _install
        └── _insttmp


The global store's `_build` directory contains the logs for each package that
is build (whether or not it was successful). The `_install` contains the final
compilation artifacts that should be retained.

#### Top Level Project Build Artifacts

###### Local Build Cache, Build Eject And Environment Cache

Not all artifacts are cached globally. Build artifacts for any symlinked
dependencies (using `yarn link`) are stored in
`./node_modules/.cache/_esy/store` which is just like the global store, but for
your locally symlinked projects, and top level package.

This local cache doesn't have the dirtyling logic as the global store for
(non-symlinked) dependencies. Currently, both symlinked dependencies and your
top level package are both rebuilt every time you run `esy build`.

Your top level package is build within its source tree, not in a copy of the
source tree, but as always your package can (and should try to) respect the out
of source destination `$cur__target_dir`.

Cached environment computations (for commands such as `esy cmd`) are stored in
`./node_modules/.cache/_esy/command-env`

Support for "ejecting" a build is computed and stored in
`./node_modules/.cache/_esy/build-eject`.


    ./node_modules/
     └─ .cache/
        └─ _esy/
           ├─ command-env
           ├─ build-eject/
           │  ├─ Makefile
           │  ├─ ...
           │  ├─ eject-env
           │  └─ node_modules   # Perfect mirror
           │     └─ FlappyBird
           │        ├─ ...
           │        └─ eject-env
           └─ store/
              ├── ThisIsBuildCacheForSymlinked
              ├── _build
              ├── _install
              └── _insttmp

#### Debugging

###### Package Cache

`esy` currently uses Yarn to perform the installs, but ensures that it uses its
own isolated package cache. (note: this is different than `esy`'s build cache).
You can see where this cache is by running:

```
dirname $(realpath `which esy`)
```

The reason why `esy` has its own cache, and the reason why it is inside of its
own binary installation location, is to ensure that when you upgrade `esy`, the
package cache will be purged. This is because many of `esy`'s opam packages are
precomputed and stored within `esy`'s internals, but then Yarn's cache will
store them in its own cache. Across `esy` upgrades, we may change how we
precompute those opam package.json's and want the cache busted.

#### Issues

Issues are still tracked at [the old `esy` repo](https://github.com/jordwalke/esy).

#### Tests

```
npm run test
```

#### Developing

When developing `esy` (or cloning the repo to use locally), you must have `filterdiff` installed (which you can obtain via `brew install patchutils`).

To make changes to `esy` and test them locally, check out and build the `esy` repo as such:

    git clone git://github.com/reasonml/esy.git
    cd esy
    npm install
    git submodule init
    git submodule update
    make convert-opam-packages

Then you may "point" to that built version of esy by simply referencing its path.

    /path/to/esy/.bin/esy build

#### Pushing a Beta Release

On a clean branch off of `origin/master`, run

    # npm install if needed.
    npm install
    git submodule init
    git submodule update
    # Substitute your version number below
    make beta-release VERSION=0.0.2

Then follow the instructions for pushing a tagged release to github.

Once pushed, other people can install that tagged release globally like this:

    npm install -g git://github.com/reasonml/esy.git#beta-v0.0.2

#### Supporting More OPAM packages

- Make sure you've ran `git submodule init` and `git submodule update`.
- Add the OPAM package name and versions to
  ./opam-packages-conversion/convertedPackages.txt
- If the package/version was recently added to `OPAM`, you should `cd` into
  `opam-packages-conversion/opam-repository`, `git fetch --all`, and then `git
  checkout origin/master` to make sure you've got the latest OPAM universe that
  you will convert from. `cd` back into the `esy` project root, and then `git
  status` will show git changes for you to commit.
- Make a new commit with all the above changes.
- Push the update to `esy` `master`.
- Clone a *fresh* new clone of `esy` (so that the submodules initialize
  correctly), then publish a new beta release as described next.

If an opam package fails to convert, inspect the output and fix any python
errors that might be causing the package conversion failure.
  

#### Debugging Failed `esy build`

When  debugging esy build — do the following:

1. `esy build-eject` creates `node_modules/.cache/esy/Makefile`
2. `make -f ./node_modules/.cache/esy/Makefile PKG_NAME.shell` will put you in a build env shell
3. Try to run commands specified in `package.json's` esy build config and see what goes wrong.

If the package is a converted opam package, you might want to inspect the
generated package.json, as well as the original opam file and make sure that it
was converted correctly.



# Yarn

**Fast:** Yarn caches every package it downloads so it never needs to download the same package again. It also parallelizes operations to maximize resource utilization so install times are faster than ever.

**Reliable:** Using a detailed, concise lockfile format and a deterministic algorithm for installs, Yarn is able to guarantee that an install that worked on one system will work exactly the same way on any other system.

**Secure:** Yarn uses checksums to verify the integrity of every installed package before its code is executed.

## Features

* **Offline Mode.** If you've installed a package before, you can install it again without any internet connection.
* **Deterministic.** The same dependencies will be installed in the same exact way on any machine, regardless of install order.
* **Network Performance.** Yarn efficiently queues up requests and avoids request waterfalls in order to maximize network utilization.
* **Network Resilience.** A single request failing won't cause an install to fail. Requests are retried upon failure.
* **Flat Mode.** Yarn resolves mismatched versions of dependencies to a single version to avoid creating duplicates.
* **More emojis.** 🐈

## Installing Yarn

Read the [Installation Guide](https://yarnpkg.com/en/docs/install) on our website for detailed instructions on how to install Yarn.

## Using Yarn

Read the [Usage Guide](https://yarnpkg.com/en/docs/usage) on our website for detailed instructions on how to use Yarn.

## Contributing to Yarn

Contributions are always welcome, no matter how large or small. Before contributing, please read the [code of conduct](CODE_OF_CONDUCT.md).

See [Contributing](CONTRIBUTING.md).

## Prior art

Yarn wouldn't exist if it wasn't for excellent prior art. Yarn has been inspired by the following projects:

 - [Bundler](https://github.com/bundler/bundler)
 - [Cargo](https://github.com/rust-lang/cargo)
 - [npm](https://github.com/npm/npm)

## Credits

Thanks to [Sam Holmes](https://github.com/samholmes) for donating the npm package name!
