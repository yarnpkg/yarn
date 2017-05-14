
#The Basics


Yarn is a package manager for your code. It allows you to use and share code with other developers from around the world. Yarn does this quickly, securely, and reliably so you don’t ever have to worry.

Yarn allows you to use other developers’ solutions to different problems, making it easier for you to develop your software. If you have problems, you can report issues or contribute back, and when the problem is fixed, you can use Yarn to keep it all up to date.

Code is shared through something called a package (sometimes referred to as a module). A package contains all the code being shared as well as a `package.json` file which describes the package.

## Installation

There are a few simple ways to install Yarn on your system and get up and running working on your Javascript based projects. Below these methods are broken down via operating system that you will be running it on

[macOS](macosInstall.md)

[Linux](linuxInstall.md)

[Windows](windowsInstall.md)

## Alternative Installations

If you are using another OS or one of the other options specific to your OS will not work for you, there are a couple of alternatives. You will need to install Node.js if you don’t already have it installed.

On common Linux distributions such as Debian, Ubuntu and CentOS, it is recommended to install Yarn via our packages instead.
Installation Script

One of the easiest ways to install Yarn on macOS and generic Unix environments is via our shell script. You can install Yarn by running the following code in your terminal:

curl -o- -L https://yarnpkg.com/install.sh | bash

### Manual Install via tarball

You can install Yarn by downloading a tarball and extracting it anywhere.

> cd /opt
> 
> wget https://yarnpkg.com/latest.tar.gz
> 
> tar zvxf yarn-*.tar.gz
 
Yarn is now in /opt/yarn-[version]/

### Install via npm

You can also install Yarn through the npm package manager if you already have it installed. If you already have Node.js installed then you should already have npm.

Once you have npm installed you can run:

> npm install --global yarn

### Path Setup
##### Unix/Linux/macOS

You will need to set up the `PATH` environment variable in your terminal to have access to Yarn’s binaries globally.

Add `export PATH="$PATH:$HOME/.yarn/bin"` to your profile (this may be in your `.profile`, `.bashrc`, `.zshrc`, etc.)

#####Windows

You will need to set up the `PATH` environment variable in your terminal to have access to Yarn’s binaries globally.

Add `set PATH=%PATH%;C:\.yarn\bin` to your shell environment.

## Post Install

> *after installation is complete you can test that your install worked properly by running yarn --version*