#!/bin/sh

set -ex

npm run build
npm pack
rm -rf dist
mkdir dist
mv yarnpkg-*.tgz dist/pack.tgz

cd dist
tar -xzf pack.tgz --strip 1
rm -rf pack.tgz
npm install --production
rm -rf node_modules/*/test node_modules/*/dist
cd ..

tar -cvzf dist/yarn-v`node dist/bin/yarn --version`.tar.gz dist/*
shasum -a 256 dist/yarn-*.tar.gz
