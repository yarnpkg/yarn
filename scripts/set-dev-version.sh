#!/bin/bash
# Set a nice build number when building master on CircleCI
# (eg. "0.16.0-alpha.123+20161018")
set -ex

original_version=`node -p "require('./package.json').version"`
version="$original_version-alpha.`date +%Y%m%d.%H%M`"
# Setting YARN_VERSION_GIT_TAG to an empty string disables Git tagging
# https://github.com/yarnpkg/yarn/issues/1228 will clean this up.
YARN_VERSION_GIT_TAG='' yarn version --new-version $version
