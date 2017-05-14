
#Windows

There are two options for installing Yarn on Windows.

##Download the installer

This will give you a .msi file that when run will walk you through installing Yarn on Windows.

If you use the installer you will first need to install Node.js.

[Download Installer](https://yarnpkg.com/latest.msi)

##Install via Chocolatey

Chocolatey is a package manager for Windows, you can install Chocolatey by following [these instructions](https://chocolatey.org/install).

Once you have Chocolatey installed, you may install yarn by running the following code in your console:

> choco install yarn

This will also ensure that you have Node.js installed.

> Note: Yarn is currently incompatible with installation via Ubuntu on Windows awaiting a resolution to [468](https://github.com/Microsoft/BashOnWindows/issues/468)
 
##Path Setup

You will need to set up the `PATH` environment variable in your terminal to have access to Yarn’s binaries globally.

Add `set PATH=%PATH%;C:\.yarn\bin` to your shell environment.

###Notice

Please whitelist your project folder and the Yarn cache directory (%LocalAppData%\Yarn) in your antivirus software, otherwise installing packages will be significantly slower as every single file will be scanned as it’s written to disk.

## Post Install

> *after installation is complete you can test that your install worked properly by running yarn --version*