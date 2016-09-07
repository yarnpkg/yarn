#!/bin/sh

npm pack
rm -rf dist
mkdir dist
mv kpm-*.tgz dist/pack.tgz

cd dist
tar -xzf pack.tgz --strip 1
rm -rf pack.tgz
npm install --production
rm -rf node_modules/*/test node_modules/*/dist
cd ..

tar -cvzf dist/kpm-v`node dist/bin/kpm --version`.tar.gz dist/*
shasum -a 256 dist/kpm-*.tar.gz
