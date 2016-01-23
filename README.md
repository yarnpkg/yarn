# kpm

alternate npm and bower client focused on flexibility, reliability, security and
integrity (basically every single software development principal).

## Features

**General**

 * Blazing fast.
 * Dependency deduping.
 * Ability to manually resolve version conflicts so only a single version per package exists.
 * Locked dependencies by default.
 * Reliable with poor networks.
 * Smart retry and timeout logic.
 * Stable public API.
 * Support for bower and npm (future CommonJS registries could easily be added).
 * Smart fetching logic for git repositories using `git archive`.

**Security**

 * Prompts user for verification for running install scripts.
 * Prompts user for verification when connecting to foreign hosts.
 * Refuses to download a tarball from HTTP without a hash.
 * Refuses to download a tarball from HTTPS if a HTTP redirect was included.
 * Refuses to clone a git repo over HTTP and plain git.
 * Blacklists known bad hosts that ping analytics servers.

## Unsupported npm features (*may* be added in the future)

 * Private modules.
 * Scoped packages.

## Intentional npm incompatibilities

 * Install scripts are ran in parallel.
 * `engine`/`os`/`cpu` fields are enforced.
 * No support for [package comments](https://github.com/npm/read-package-json#indexjs).
 * No support for dependency strings/arrays. ie. `{ dependencies: "lodash=>latest,babel-core=>^6.0.0" }` or `{ dependencies: ["lodash=>latest", "babel-core=>^6.0.0"] }`.

## Screenshot

Installing `react-native`, 700 transitive dependencies with no cache.

![Screenshot showing the react native package downloading in 30 seconds](https://i.imgur.com/rUta2sk.gif)

## Usage

```sh
$ git clone git@github.com:kittens/kpm.git
$ cd kpm
$ npm install
$ make build
$ npm link
# go into some random directory
$ mkdir node_modules
$ kpm install your-package
```

## What problems are you trying to solve?

### Non-determinism

The npm dependency graph is nondeteriministic and is dependent on install order. This is
terrible for reproducible builds. This is traditionally mitigated by npm with a lock file
and the reshuffling of dependencies inside the graph. This however isn't adequate. The use
of a [CAS](https://en.wikipedia.org/wiki/Content-addressable_storage) for storing modules
and sane version resolution against this tree, as long as always using a shrinkwrap by
default should allow for deterministic dependency graphs.

### Option for a flat tree and a single version per package

This is extremely important for ecosystems relying on Bower today. It makes it very hard
to reason about what modules you're actually using and can lead to bloat and dependency
creep.

Loading modules is traditionally very easy with a flat structure as you have a single
place to look for modules making the resolution extremely fast.

A flat structure can easily be implemented through the use of the previously mentioned CAS
storage. After package resolution is performed, a list of all duplicate packages are built
and it's reduced to a single version via a console UI and some analysis.

### Sensible defaults

**Shrinkwrap** See the [more security](#more-security) section.

**Deduping** Due to the use of a CAS system, there doesn't need to be any deduping as
modules are stored in one central folder so all duplications resolve to the same module.
Due to the directory structure introduced by CAS, modules cannot access others higher in
their tree meaning you only have access to the modules you've specified in your `package.json`

**Prune extraneous** It's extremely common for the following scenario to occur:

 - Kim and Bob work on KPM
 - Kim and Bob have the exact same lock checkout (that includes `babel` as a dependency)
 - Kim removes `babel` from `package.json`
 - Kim commits updated lockfile + package + pushes
 - Bob downloads, and runs `kpm install`.
 - Bob doesn't realise that Kim removed the `babel` dependency and uses it in his code
   because it still exists in `node_modules`.

This can be mitigated by automatically pruning extraneous modules on install.

### More security

**Locked dependencies by default** By default npm does not enforce the use of a lockfile.
This means that a lot of users aren't protected by accidental breakages.

**Verification of executing lifecycle commands** When installing packages from npm, any
package can run arbitrary commands on package install. This is dangerous and allows for a
variety of vulnerabilities. Prompting the user for verification to run an install script
and storing the answer in the shrinkwrap will ensure that only verified commands are
executed.

**Verification of connecting to foreign hosts** It's unfortunately common for
[large packages to track users](https://github.com/strongloop/loopback/issues/1079).
When connecting to foreign hosts that we don't have explicitly in a whitelist we should
prompt the user for verification. Once the resolved version has been stored in the
shrinkwrap then the check will be skipped.

**Analysis of new packages and updated packages** It's hard to know what new dependencies,
owners, and potential access have been granted when installing and updating packages.
There needs to be more insight into what has actually been introduced with an update. This
can be achieved through tool assisted code and metadata review. Showing you explicitly what
new dependencies have been introduced, the files that have been touched and alerting you
to possible patterns worth investigation. It's important for any type of analysis to be
extremely explicit so there's no false sense of security and laziness when reviewing new
third party dependencies.

### Better performance

**Network performance** TODO

**Parallelism** TODO

## Stable and flexible public Node API

Lots of build systems today are consuming `npm`. The npm API relies a lot on global state,
can exit the process mid-command if it gets grumpy and has inconsistent logging and
reporting behaviour.

One project goal is to have an extremely flexible API that build tools can consume.
