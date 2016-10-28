#!/bin/bash

set -ex

# Ensure all the tools we need are available
ensureAvailable() {
  command -v "$1" >/dev/null 2>&1 || (echo "You need to install $1" && exit 2)
}
ensureAvailable dpkg-deb
ensureAvailable fpm
ensureAvailable fakeroot
ensureAvailable lintian
ensureAvailable rpmbuild

PACKAGE_TMPDIR=tmp/debian_pkg
VERSION=`dist/bin/yarn --version`
OUTPUT_DIR=artifacts
TARBALL_NAME=$OUTPUT_DIR/yarn-v$VERSION.tar.gz
DEB_PACKAGE_NAME=yarn_$VERSION'_all.deb'

if [ ! -e $TARBALL_NAME ]; then
  echo "Hey! Listen! You need to run build-dist.sh first."
  exit 1
fi;

mkdir -p $OUTPUT_DIR
# Remove old packages
rm -f $OUTPUT_DIR/*.deb $OUTPUT_DIR/*.rpm

# Extract to a temporary directory
rm -rf $PACKAGE_TMPDIR
mkdir -p $PACKAGE_TMPDIR/
umask 0022 # Ensure permissions are correct (0755 for dirs, 0644 for files)
tar zxf $TARBALL_NAME -C $PACKAGE_TMPDIR/

# Create Linux package structure
mkdir -p $PACKAGE_TMPDIR/usr/share/yarn/
mkdir -p $PACKAGE_TMPDIR/usr/share/doc/yarn/
mv $PACKAGE_TMPDIR/dist/bin $PACKAGE_TMPDIR/usr/share/yarn/
mv $PACKAGE_TMPDIR/dist/lib $PACKAGE_TMPDIR/usr/share/yarn/
mv $PACKAGE_TMPDIR/dist/lib-legacy $PACKAGE_TMPDIR/usr/share/yarn/
mv $PACKAGE_TMPDIR/dist/node_modules $PACKAGE_TMPDIR/usr/share/yarn/
mv $PACKAGE_TMPDIR/dist/package.json $PACKAGE_TMPDIR/usr/share/yarn/
cp resources/debian/copyright $PACKAGE_TMPDIR/usr/share/doc/yarn/copyright

# These are unneeded and throw lintian lint errors
rm -f $PACKAGE_TMPDIR/usr/share/yarn/node_modules/node-uuid/benchmark/bench.gnu
find $PACKAGE_TMPDIR/usr/share/yarn \( -name '*.md' -o  -name '*.md~' -o -name '*.gitmodules' \) -delete

# Assume everything else is junk we don't need
rm -rf $PACKAGE_TMPDIR/dist

# Swap out the basedir calculation code with a hard-coded path, as the default
# way we do this doesn't follow symlinks.
sed -i 's/basedir\=\$.*/basedir=\/usr\/share\/yarn\/bin/' $PACKAGE_TMPDIR/usr/share/yarn/bin/yarn

# The Yarn executable expects to be in the same directory as the libraries, so
# we can't just copy it directly to /usr/bin. Symlink them instead.
mkdir -p $PACKAGE_TMPDIR/usr/bin/
ln -s ../share/yarn/bin/yarn $PACKAGE_TMPDIR/usr/bin/yarn
# Alias as "yarnpkg" too.
ln -s ../share/yarn/bin/yarn $PACKAGE_TMPDIR/usr/bin/yarnpkg

# Common FPM parameters for all packages we'll build using FPM
FPM="fpm --input-type dir --chdir $PACKAGE_TMPDIR --name yarn --version $VERSION "`
  `"--vendor 'Yarn Contributors <yarn@dan.cx>' --maintainer 'Yarn Contributors <yarn@dan.cx>' "`
  `"--url https://yarnpkg.com/ --license BSD --description '$(cat resources/debian/description)'"

##### Build RPM (CentOS, Fedora) package
eval "$FPM --output-type rpm  --architecture noarch --depends nodejs --category 'Development/Languages' ."
mv *.rpm $OUTPUT_DIR

##### Build DEB (Debian, Ubuntu) package
mkdir -p $PACKAGE_TMPDIR/DEBIAN
mkdir -p $PACKAGE_TMPDIR/usr/share/lintian/overrides/
cp resources/debian/lintian-overrides $PACKAGE_TMPDIR/usr/share/lintian/overrides/yarn

# Replace variables in Debian package control file
INSTALLED_SIZE=`du -sk $PACKAGE_TMPDIR | cut -f 1`
sed -e "s/\$VERSION/$VERSION/;s/\$INSTALLED_SIZE/$INSTALLED_SIZE/" < resources/debian/control.in > $PACKAGE_TMPDIR/DEBIAN/control
fakeroot dpkg-deb -b $PACKAGE_TMPDIR $DEB_PACKAGE_NAME
mv $DEB_PACKAGE_NAME $OUTPUT_DIR

rm -rf $PACKAGE_TMPDIR

# Lint the Debian package to ensure we're not doing something silly
lintian $OUTPUT_DIR/$DEB_PACKAGE_NAME
