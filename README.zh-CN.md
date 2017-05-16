<p align="center">
  <a href="https://yarnpkg.com/">
    <img alt="Yarn" src="https://github.com/yarnpkg/assets/blob/master/yarn-kitten-full.png?raw=true" width="546">
  </a>
</p>

<p align="center">
  快速、可靠且安全的模块管理器。
</p>

<p align="center">
  <a href="https://travis-ci.org/yarnpkg/yarn"><img alt="Travis Status" src="https://travis-ci.org/yarnpkg/yarn.svg"></a>
  <a href="https://circleci.com/gh/yarnpkg/yarn"><img alt="Circle Status" src="https://circleci.com/gh/yarnpkg/yarn.svg?style=svg&circle-token=5f0a78473b0f440afb218bf2b82323cc6b3cb43f"></a>
  <a href="https://ci.appveyor.com/project/kittens/yarn/branch/master"><img alt="Appveyor Status" src="https://ci.appveyor.com/api/projects/status/0xdv8chwe2kmk463?svg=true"></a>
  <a href="https://discord.gg/yarnpkg"><img alt="Discord Chat" src="https://discordapp.com/api/guilds/226791405589233664/widget.png"></a>
</p>

---

**快速：** Yarn 缓存每一个它下载的包，所以它永远不需要再次下载同一个包。它还可以并行操作以最大限度地提高资源利用率，所以安装时间比以往都快。

**可靠：** 使用详细的、简洁的锁定文件格式和确定性算法的安装，Yarn 能保证在一个系统上的安装工作也能在其他系统上以完全相同的方式进行。

**安全：** Yarn 会使用 checksum 校验以在代码运行之前验证每个已安装的包的完整性。

## 特色

* **离线模式** 如果你之前安装过一个包，那么你就可以在没有网络连接的情况下再次安装它。

* **确定性** 同一个依赖会以相同的方式安装在设备上，无论安装顺序如何。

* **网络性能** Yarn 高效地处理请求，避免请求拥挤，以最大限度地提高网络利用率。

* **网络弹性** 某个请求的失败不会导致安装失败，请求失败时会重试。

* **平坦化.** Yarn 将依赖的不匹配的版本变为一个单一的版本，以避免重复创建。
* **更多的emoji支持** 🐈

## 安装 Yarn

阅读[安装指南](https://yarnpkg.com/en/docs/install)以获取安装 Yarn 的详细介绍。

## 使用 Yarn

阅读[使用指南](https://yarnpkg.com/en/docs/usage)以获取如何使用 Yarn 的详细介绍。

## 贡献你的代码

我们向来欢迎您贡献您的代码，无论多少。在您开始之前，请阅读[code of conduct](CODE_OF_CONDUCT.md)。

参考 [Contributing](CONTRIBUTING.md).

## 致敬先人

正所谓“站在巨人的肩膀上”，Yarn 也因此而生。 Yarn 的诞生深受以下项目的启发：

 - [Bundler](https://github.com/bundler/bundler)
 - [Cargo](https://github.com/rust-lang/cargo)
 - [npm](https://github.com/npm/npm)

## 鸣谢

感谢 [Sam Holmes](https://github.com/samholmes) 贡献此 npm 包的名字。