#Debian/Ubuntu Linux

On Debian or Ubuntu Linux, you can install Yarn via our Debian package repository. You will first need to configure the repository:

> sudo apt-key adv --keyserver pgp.mit.edu --recv D101F7899D41F3C3
> 
>echo "deb http://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list

On Ubuntu 14.04 and Debian Stable, you will also need to configure [the NodeSource repository](https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions) to get a new enough version of Node.js (Debian Testing and Ubuntu 16.04 come packaged with a sufficient version of Node.js, so this step is not required in those environments)

Then you can simply:

>sudo apt-get update && sudo apt-get install yarn

#CentOS / Fedora / RHEL

On CentOS, Fedora and RHEL, you can install Yarn via our RPM package repository.

>sudo wget https://dl.yarnpkg.com/rpm/yarn.repo -O /etc/yum.repos.d/yarn.repo

If you do not already have Node.js installed, you should also configure [the NodeSource repository](https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions):

> curl --silent --location https://rpm.nodesource.com/setup_6.x | bash -

Then you can simply:

>sudo yum install yarn

#Arch Linux

On Arch Linux yarn can be installed through the AUR.

If you use an AUR Helper such as yaourt you can simply run:

>yaourt -S yarn

#Solus

On Solus, you can install yarn via the Solus repository.

>sudo eopkg install yarn

##Path Setup

You will need to set up the `PATH` environment variable in your terminal to have access to Yarn’s binaries globally.

Add `export PATH="$PATH:$HOME/.yarn/bin"` to your profile (this may be in your `.profile`, `.bashrc`, `.zshrc`, etc.)

## Post Install

> *after installation is complete you can test that your install worked properly by running yarn --version*
