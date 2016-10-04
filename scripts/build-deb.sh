#!/bin/bash

set -ex

PACKAGE_TMPDIR=tmp/debian_pkg
VERSION=`node dist/bin/yarn --version`
TARBALL_NAME=dist/yarn-v$VERSION.tar.gz
PACKAGE_NAME=yarn_$VERSION'_all.deb'

if [ ! -e $TARBALL_NAME ]; then
  echo "Hey! Listen! You need to run build-dist.sh first."
  exit 1
fi;

# Remove old packages
rm -f dist/*.deb

# Extract to a temporary directory
rm -rf $PACKAGE_TMPDIR
mkdir -p $PACKAGE_TMPDIR/
tar zxf $TARBALL_NAME -C $PACKAGE_TMPDIR/

# Create Debian structure
mkdir -p $PACKAGE_TMPDIR/DEBIAN
mkdir -p $PACKAGE_TMPDIR/usr/share/yarn/
mkdir -p $PACKAGE_TMPDIR/usr/share/doc/yarn/
mkdir -p $PACKAGE_TMPDIR/usr/share/lintian/overrides/
mv $PACKAGE_TMPDIR/dist/bin $PACKAGE_TMPDIR/usr/share/yarn/
mv $PACKAGE_TMPDIR/dist/lib $PACKAGE_TMPDIR/usr/share/yarn/
mv $PACKAGE_TMPDIR/dist/lib-legacy $PACKAGE_TMPDIR/usr/share/yarn/
mv $PACKAGE_TMPDIR/dist/node_modules $PACKAGE_TMPDIR/usr/share/yarn/
mv $PACKAGE_TMPDIR/dist/package.json $PACKAGE_TMPDIR/usr/share/yarn/
cp resources/debian/copyright $PACKAGE_TMPDIR/usr/share/doc/yarn/copyright
cp resources/debian/lintian-overrides $PACKAGE_TMPDIR/usr/share/lintian/overrides/yarn

# These are unneeded and throw lintian lint errors
rm -f $PACKAGE_TMPDIR/usr/share/yarn/node_modules/node-uuid/benchmark/bench.gnu
find $PACKAGE_TMPDIR/usr/share/yarn \( -name '*.md' -o  -name '*.md~' -o -name '*.gitmodules' \) -delete

# Assume everything else is junk we don't need
rm -rf $PACKAGE_TMPDIR/dist

# Currently the "binaries" are JavaScript files that expect to be in the same
# directory as the libraries, so we can't just copy them directly to /usr/bin.
# Symlink them instead.
mkdir -p $PACKAGE_TMPDIR/usr/bin/
ln -s ../share/yarn/bin/yarn.js $PACKAGE_TMPDIR/usr/bin/yarn

# Debian/Ubuntu call the Node.js binary "nodejs", not "node".
sed -i 's/env node/env nodejs/' $PACKAGE_TMPDIR/usr/share/yarn/bin/yarn.js

# Replace variables in Debian package control file
INSTALLED_SIZE=`du -sk $PACKAGE_TMPDIR | cut -f 1`
sed -e "s/\$VERSION/$VERSION/;s/\$INSTALLED_SIZE/$INSTALLED_SIZE/" < resources/debian/control.in > $PACKAGE_TMPDIR/DEBIAN/control

# This is the moment we've all been waiting for
fakeroot dpkg-deb -b $PACKAGE_TMPDIR $PACKAGE_NAME
mv $PACKAGE_NAME dist/
rm -rf $PACKAGE_TMPDIR

lintian dist/$PACKAGE_NAME
