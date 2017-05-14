# macOS

You will need to first install Node.js if you don’t already have it installed.
### Homebrew

You can install Yarn through the Homebrew package manager. This will also install Node.js if it is not already installed.

> brew update &&
brew install yarn

## Path Setup

You will need to set up the `PATH` environment variable in your terminal to have access to Yarn’s binaries globally.

Add `export PATH="$PATH:$HOME/.yarn/bin"` to your profile (this may be in your `.profile`, `.bashrc`, `.zshrc`, etc.)

## Post Install

> *after installation is complete you can test that your install worked properly by running yarn --version*