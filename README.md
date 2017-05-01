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
  <a href="https://discord.gg/yarnpkg"><img alt="Discord Chat" src="https://img.shields.io/discord/226791405589233664.svg"></a>
</p>

---

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

Contributions are always welcome, no matter how large or small. Substantial feature requests should be proposed as an [RFC](https://github.com/yarnpkg/rfcs). Before contributing, please read the [code of conduct](CODE_OF_CONDUCT.md).

See [Contributing](CONTRIBUTING.md).

## Prior art

Yarn wouldn't exist if it wasn't for excellent prior art. Yarn has been inspired by the following projects:

 - [Bundler](https://github.com/bundler/bundler)
 - [Cargo](https://github.com/rust-lang/cargo)
 - [npm](https://github.com/npm/npm)

## Credits

Thanks to [Sam Holmes](https://github.com/samholmes) for donating the npm package name!
