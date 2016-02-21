<p align="center">
  <a href="https://facebook.github.io/kpm">
    <img alt="kpm" src="https://github.com/facebook/kpm/blob/master/assets/logo.png?raw=true" width="546">
  </a>
</p>

<p align="center">
  alternate npm and bower client focused on security and performance.
</p>

<p align="center">
  <a href="https://travis-ci.org/facebook/kpm"><img alt="Travis Status" src="https://img.shields.io/travis/facebook/kpm/master.svg?style=flat&label=travis"></a>
  <a href="https://ci.appveyor.com/project/facebook/kpm/branch/master"><img alt="Appveyor Status" src="https://img.shields.io/appveyor/ci/facebook/kpm.svg?style=flat&label=appveyor"></a>
  <a href="https://codecov.io/github/facebook/kpm"><img alt="Coverage Status" src="https://img.shields.io/codecov/c/github/facebook/kpm/master.svg?style=flat"></a>
</p>

---

At Facebook we use npm heavily for all of our JavaScript projects. Unfortunately npm is
lacking in key areas that are important to us. The changes we've made are quite extensive
and require significant changes to npm including the internal architecture and workflow for
casual users.

kpm is written from scratch and uses the existing npm registry for module hosting, it's
completely compatible with the npm ecosystem and is only an alternative to the npm client.

## Features

* Greatly improved performance: Client is always performing operations such as package
  resolving and fetching due to the internal architecture.
* Dependency deduping: Reduces the duplication of modules reducing code size.
* Ability to manually resolve version conflicts so only a single version per package
  exists. (Bower style)
* Resilient to network flakiness: Smart retry and timeout logic ensures reliability on
  poor networks such as conference wifi, mobile networks etc.
* Stable public API: Tooling such as build systems can reliably hook into internals.
* Reproducible builds: Updates are intentional by default which means builds cannot
  randomly break because of dependency updates.
* More emojis. 🐈

**Security**

* Locked dependencies by default.
* Prompts user for verification for running install scripts.
* Prompts user for verification when connecting to foreign hosts.
* Refuses to download a tarball from HTTP without a hash.
* Refuses to download a tarball from HTTPS if an HTTP redirect was included.
* Refuses to clone a git repo over HTTP and plain git.
* Blacklists known bad hosts that ping analytics servers.
* Lockfile contains tarball hashes to ensure integrity of package downloads. Lockfile
  contains tarball hashes to ensure integrity of package downloads.
* Generate reports when installing and updating dependencies. Contains diffs of module
  code and analyses modules for possible points of conflict such as suspicious code.

## Screenshot

Installing `react-native`, 700 transitive dependencies with no cache over WiFi on a 25
megabit down connection.

![Screenshot showing the react native package downloading in 30 seconds](https://i.imgur.com/rUta2sk.gif)

## Usage (while in development)

```sh
$ git clone git@github.com:facebook/kpm.git
$ cd kpm
$ npm install
$ make build
$ npm link
# go into some random directory
$ mkdir node_modules
$ kpm install your-package
```

## FAQ

### What does kpm stand for?

Kittens package manager

### How is this different to existing alternate npm clients such as [ied](https://github.com/alexanderGugel/ied) and [pnpm](https://github.com/rstacruz/pnpm)?

Similar in many aspects but unlike existing alternate npm clients, kpm is focused on
security first, good performance is just an implementation detail. If we only cared about
performance we'd help improve npm.

### Why not contribute back to npm?

The changes we've made significantly change the workflow that developers who use npm are
used to. We believe this is for the best but we understand that this isn't for everyone.

kpm is a package manager in a niche and we hope that some of our ideas make it's way back
into the main npm client.

## What problems are you trying to solve?

**NOTE:** This is not an exhaustive list and is not a direct comparison to npm.

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

 - Kim and Bob are working on a project.
 - Kim and Bob have the exact same lock checkout (that includes `babel` as a dependency).
 - Kim removes `babel` from `package.json`.
 - Kim commits updated lockfile, `package.json` and pushes.
 - Bob downloads, and runs `kpm install`.
 - Bob doesn't realise that Kim removed the `babel` dependency and uses it in his code
   because it still exists in his local `node_modules`.

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

### Reliability

**Network reliability** TODO

### Better performance

**Network performance** TODO

**Parallelism** TODO

## Stable and flexible public Node API

Lots of build systems today are consuming `npm`. The npm API relies a lot on global state,
can exit the process mid-command if it gets grumpy and has inconsistent logging and
reporting behaviour.

One project goal is to have an extremely flexible API that build tools can consume.
