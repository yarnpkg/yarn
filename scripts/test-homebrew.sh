#!/bin/bash
set -ex

# setup
export HOMEBREW_DEVELOPER="1"

# get latest definitions
sudo chown -R $USER $(brew --repo)
git -C $(brew --repo) reset --hard origin/master
git -C $(brew --repo) clean -qxdff

# setup tap
mkdir -p $(brew --repo)/Library/Taps/yarnpkg
ln -s $PWD $(brew --repo)/Library/Taps/yarnpkg/homebrew-yarn
cd $(brew --repo)/Library/Taps/yarnpkg/homebrew-yarn

# change travis build directory
export TRAVIS_BUILD_DIR="$(brew --repo)/Library/Taps/yarnpkg/homebrew-yarn"

# test
brew test-bot --no-bottle
