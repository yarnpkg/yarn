#!/bin/bash
# Bootstraps a Yarn development environment on Ubuntu.
set -ex

sudo apt-get install -y rpm lintian
gem install fpm
