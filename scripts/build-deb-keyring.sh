#!/usr/bin/env bash

set -ex

# Ensure all the tools we need are available
ensureAvailable() {
  command -v "$1" >/dev/null 2>&1 || (echo "You need to install $1" && exit 2)
}
ensureAvailable dpkg-deb
ensureAvailable lintian
ensureAvailable gpg

# If not set, $VERSION will be the current date
: ${VERSION:=$(date +%Y.%m.%d)}
OUTPUT_DIR=artifacts
PACKAGE_NAME=yarn-archive-keyring
DEB_PACKAGE_FILE="${PACKAGE_NAME}_${VERSION}_all.deb"
PACKAGE_TMPDIR="tmp/$PACKAGE_NAME"

if (( ${#@} < 1 )); then
  echo "Usage: $0 GPG_KEY_ID" && exit 1
else
  GPG_KEY_ID="$1"
fi

mkdir -p $OUTPUT_DIR
# Remove old packages
rm -f $OUTPUT_DIR/*.deb

# Create temporary directory to start building up the package
rm -rf $PACKAGE_TMPDIR
mkdir -p $PACKAGE_TMPDIR/
umask 0022 # Ensure permissions are correct (0755 for dirs, 0644 for files)
PACKAGE_TMPDIR_ABSOLUTE=$(readlink -f $PACKAGE_TMPDIR)

# Create Debian package structure
mkdir -p "${PACKAGE_TMPDIR}/etc/apt/trusted.gpg.d"
mkdir -p "${PACKAGE_TMPDIR}/usr/share/keyrings"
mkdir -p "${PACKAGE_TMPDIR}/usr/share/doc/${PACKAGE_NAME}"
cp \
  resources/debian/copyright \
  "${PACKAGE_TMPDIR}/usr/share/doc/${PACKAGE_NAME}/copyright"

gpg \
  --export \
  --output "${PACKAGE_TMPDIR}/etc/apt/trusted.gpg.d/${PACKAGE_NAME}.gpg" \
  "$GPG_KEY_ID"
cp \
  "${PACKAGE_TMPDIR}/etc/apt/trusted.gpg.d/${PACKAGE_NAME}.gpg" \
  "${PACKAGE_TMPDIR}/usr/share/keyrings/${PACKAGE_NAME}.gpg"
# No changelog file at the moment
mkdir -p $PACKAGE_TMPDIR/usr/share/lintian/overrides/
printf "# %s\n%s: %s\n" \
  "No changelog file at the moment" \
  "${PACKAGE_NAME}" \
  "changelog-file-missing-in-native-package" \
  > "${PACKAGE_TMPDIR}/usr/share/lintian/overrides/${PACKAGE_NAME}"

# Build up the control files
mkdir -p "${PACKAGE_TMPDIR}/DEBIAN"
echo "/etc/apt/trusted.gpg.d/${PACKAGE_NAME}.gpg" \
  > "${PACKAGE_TMPDIR}/DEBIAN/conffiles"

# Replace variables in Debian package control file
INSTALLED_SIZE=`du -sk $PACKAGE_TMPDIR | cut -f 1`
sed \
  -e "s/\$VERSION/$VERSION/" \
  -e "s/\$INSTALLED_SIZE/$INSTALLED_SIZE/" \
  -e "s/\$PACKAGE_NAME/$PACKAGE_NAME/" \
  < resources/debian/keyring.control.in \
  > $PACKAGE_TMPDIR/DEBIAN/control
fakeroot dpkg-deb -b $PACKAGE_TMPDIR $DEB_PACKAGE_FILE
mv $DEB_PACKAGE_FILE $OUTPUT_DIR

rm -rf $PACKAGE_TMPDIR

# Lint the Debian package to ensure we're not doing something silly
lintian $OUTPUT_DIR/$DEB_PACKAGE_FILE
