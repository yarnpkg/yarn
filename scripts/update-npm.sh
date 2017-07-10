#!/bin/bash
# Pushes the latest Yarn version to npm

set -ex

# See if YARN_VERSION was passed in the environment, otherwise get version
# number from Yarn site
if [ -z "$YARN_VERSION" ]; then
  echo 'Getting Yarn version from https://yarnpkg.com/latest-version'
  version=`curl --fail https://yarnpkg.com/latest-version`
else
  version="$YARN_VERSION"
fi

# Check if this version is already published to npm.
# Note: npm doesn't return a non-zero error code when "npm view" can't find a
# package, so we need to improvise by checking that the value is what we expect.
if [ "`npm view yarn@$version name`" = 'yarn' ]; then
  echo "$version is already available on npm"
  exit 0
fi;

# Grab the tarball so we can publish it as-is
url=https://yarnpkg.com/downloads/$version/yarn-v$version.tar.gz
tempfile=`mktemp -t 'yarn-release-XXXXXXXX.tar.gz'`
curl --fail -L -o $tempfile $url

npm_flags=''
if [ "$YARN_RC" = "true" ]; then
  npm_flags='--tag rc'
fi;

eval "npm publish '$tempfile' --access public $npm_flags"
