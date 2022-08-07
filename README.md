<p align="center">
  <a href="https://yarnpkg.com/">
    <img alt="Yarn" src="https://github.com/yarnpkg/assets/blob/master/yarn-kitten-full.png?raw=true" width="546">
  </a>
</p>

<p align="center">
  Fast, reliable, and secure dependency management.
</p>

<p align="center">
  <a href="https://circleci.com/gh/yarnpkg/yarn"><img alt="Circle Status" src="https://circleci.com/gh/yarnpkg/yarn.svg?style=shield&circle-token=5f0a78473b0f440afb218bf2b82323cc6b3cb43f"></a>
  <a href="https://ci.appveyor.com/project/kittens/yarn/branch/master"><img alt="Appveyor Status" src="https://ci.appveyor.com/api/projects/status/0xdv8chwe2kmk463?svg=true"></a>
  <a href="https://dev.azure.com/yarnpkg/yarn/_build"><img alt="Azure Pipelines status" src="https://dev.azure.com/yarnpkg/yarn/_apis/build/status/Yarn%20Acceptance%20Tests"></a>
  <a href="https://discord.gg/yarnpkg"><img alt="Discord Chat" src="https://img.shields.io/discord/226791405589233664.svg"></a>
  <a href="http://commitizen.github.io/cz-cli/"><img alt="Commitizen friendly" src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg"></a>
</p>

---

**Fast:** Yarn caches every package it has downloaded, so it never needs to download the same package again. It also does almost everything concurrently to maximize resource utilization. This means even faster installs.

**Reliable:** Using a detailed but concise lockfile format and a deterministic algorithm for install operations, Yarn is able to guarantee that any installation that works on one system will work exactly the same on another system.

**Secure:** Yarn uses checksums to verify the integrity of every installed package before its code is executed.

## Features

* **Offline Mode.** If you've installed a package before, then you can install it again without an internet connection.
* **Deterministic.** The same dependencies will be installed in the same exact way on any machine, regardless of installation order.
* **Network Performance.** Yarn efficiently queues requests and avoids request waterfalls in order to maximize network utilization.
* **Network Resilience.** A single request that fails will not cause the entire installation to fail. Requests are automatically retried upon failure.
* **Flat Mode.** Yarn resolves mismatched versions of dependencies to a single version to avoid creating duplicates.
* **More emojis.** 🐈

## Our supports

### [Gold sponsors](https://opencollective.com/yarnpkg)

<table width="100%">
  <tr>
    <td>
      <a href="https://www.doppler.com/?utm_campaign=github_repo&utm_medium=referral&utm_content=yarn&utm_source=github#gh-light-mode-only">
        <img src="https://assets.website-files.com/5de9972f49103c5df3964004/5f0c1146992a5e9e4fa553e6_logo.svg" width="140"/>
      </a>
      <a href="https://www.doppler.com/?utm_campaign=github_repo&utm_medium=referral&utm_content=yarn&utm_source=github#gh-dark-mode-only">
        <img src="https://user-images.githubusercontent.com/1037931/151548177-308f0a41-fb0e-4311-9969-4a2455b08686.svg" width="140"/>
      </a>
    </td>
    <td>
      <b>All your environment variables, in one place</b>. Stop struggling with scattered API keys, hacking together home-brewed tools, and avoiding access controls. Keep your team and servers in sync with <b><a href="https://www.doppler.com/?utm_campaign=github_repo&utm_medium=referral&utm_content=yarn&utm_source=github">Doppler</a></b>.
    </td>
  </tr>
  <tr>
    <td>
      <a href="https://workos.com/?utm_campaign=github_repo&utm_medium=referral&utm_content=berry&utm_source=github#gh-light-mode-only">
        <img src="https://user-images.githubusercontent.com/1037931/151547094-7aa4a5cb-07e4-4b8a-ab8f-0a15fd63ab7d.svg" width="140"/>
      </a>
      <a href="https://workos.com/?utm_campaign=github_repo&utm_medium=referral&utm_content=berry&utm_source=github#gh-dark-mode-only">
        <img src="https://user-images.githubusercontent.com/1037931/151547899-3655e0d3-3bdb-4351-bd75-af2bebd3ce92.svg" width="140"/>
      </a>
    </td>
    <td>
      <b>Your app, enterprise-ready</b>. Start selling to enterprise customers with just a few lines of code. Add Single Sign-On (and more) in minutes instead of months with <b><a href="https://workos.com/?utm_campaign=github_repo&utm_medium=referral&utm_content=berry&utm_source=github">WorkOS</a></b>.
    </td>
  </tr>
</table>

## Installing Yarn

Read the [Installation Guide](https://yarnpkg.com/en/docs/install) on our website for detailed instructions on how to install Yarn.

## Using Yarn

Read the [Usage Guide](https://yarnpkg.com/en/docs/usage) on our website for detailed instructions on how to use Yarn.

## Contributing to Yarn

The 1.x codebase is fairly old and will only accept security fixes. For new features or bugfixes, please see our new [repository](https://github.com/yarnpkg/berry) and its [contribution guide](https://yarnpkg.com/advanced/contributing).

## Prior art

Yarn wouldn't exist if it wasn't for excellent prior art. Yarn has been inspired by the following projects:

 - [Bundler](https://github.com/bundler/bundler)
 - [Cargo](https://github.com/rust-lang/cargo)
 - [npm](https://github.com/npm/cli)

## Credits

Thanks to [Sam Holmes](https://github.com/samholmes) for donating the npm package name!
