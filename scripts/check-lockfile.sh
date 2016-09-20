#!/bin/bash

set -ex

DIR="TEMP_LOCKFILE_CHECK"

# build yarn
npm run build

# create temp directory
rm -rf $DIR
mkdir $DIR
cp package.json yarn.lock $DIR
cd $DIR

# install with yarn and run check
../bin/yarn.js install --pure-lockfile
../bin/yarn.js check

# cleanup
cd ..
rm -rf $DIR
