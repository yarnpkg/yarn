#!/bin/bash
# Pushes the locally built Yarn version to npm

set -ex

version=`./dist/bin/yarn --version`
tarball="./artifacts/yarn-v$version.tar.gz"

# Ensure Yarn tarball was built
if [ ! -f "$tarball" ]; then
  echo 'Could not find Yarn tarball; please re-run "yarn build-dist".'
  exit 1
fi;

# Check if this version is already published to npm.
# Note: npm doesn't return a non-zero error code when "npm view" can't find a
# package, so we need to improvise by checking that the value is what we expect.
if [ "`npm view yarn@$version name`" = 'yarn' ]; then
  echo "$version is already available on npm"
  exit 0
fi;

# Determine if this is an RC or a stable release
release_type=`curl --compressed --fail https://release.yarnpkg.com/release_type/$version`
npm_flags=''
if [ "$release_type" = "rc" ]; then
  npm_flags='--tag rc'
fi;

eval "npx npm@4 publish '$tarball' --access public $npm_flags"
