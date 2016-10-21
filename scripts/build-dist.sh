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
# Change this to "yarn install --production" once #1115 is fixed
npm install --production
rm -rf node_modules/*/test node_modules/*/dist
cd ..

tar -cvzf artifacts/yarn-v`dist/bin/yarn --version`.tar.gz dist/*
shasum -a 256 artifacts/yarn-*.tar.gz
