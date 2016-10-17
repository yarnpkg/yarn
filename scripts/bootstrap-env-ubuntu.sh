#!/bin/bash
# Bootstraps a Yarn development environment on Ubuntu.
set -ex

# Add Yarn package repo - We require Yarn to build Yarn itself :D
sudo apt-key adv --keyserver pgp.mit.edu --recv D101F7899D41F3C3
echo "deb http://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list

sudo apt-get update -qq
sudo apt-get install -y rpm lintian yarn
gem install fpm
