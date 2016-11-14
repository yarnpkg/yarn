#!/bin/sh

set -ex

npm run build
npm pack
rm -rf dist
mkdir dist
mkdir -p artifacts
mv yarn-*.tgz dist/pack.tgz

cd dist
umask 0022 # Ensure permissions are correct (0755 for dirs, 0644 for files)
tar -xzf pack.tgz --strip 1
rm -rf pack.tgz
../scripts/copy-dist-dependencies.js
../scripts/set-installation-method.js $(readlink -f package.json) tar
cd ..

tar -cvzf artifacts/yarn-v`dist/bin/yarn --version`.tar.gz dist/*
shasum -a 256 artifacts/yarn-*.tar.gz
