#!/bin/sh
set -ex

# This is similar to build-dist.sh, except it includes the original .js files
# rather than bundling them into a single .js file. This distribution can
# potentially be useful for debugging purposes, but it's more bloated than the
# regular distribution.

yarn build
yarn pack
rm -rf dist-debug
mkdir dist-debug
mkdir -p artifacts
mv yarn-*.tgz dist-debug/pack.tgz

cd dist-debug
umask 0022 # Ensure permissions are correct (0755 for dirs, 0644 for files)
tar -xzf pack.tgz --strip 1
rm -rf pack.tgz
# Change this to "yarn install --production" once #1115 is fixed
yarn install --production
../scripts/update-dist-manifest.js $(readlink -f package.json) tar
cd ..

tar -cvzf artifacts/yarn-v`dist-debug/bin/yarn --version`.tar.gz dist-debug/*
shasum -a 256 artifacts/yarn-*.tar.gz
