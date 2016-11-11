#!/bin/bash
# Executed within a fresh Docker container to test installation and execution of Yarn.
set -ex

. /etc/lsb-release

# Set proxy if one was passed in (eg. if caching on the host machine using apt-cacher-ng)
if [ -n "$APT_PROXY" ]; then
    echo 'Acquire::http::proxy "http://'$APT_PROXY'";' > /etc/apt/apt.conf.d/02proxy
fi;

# Add Yarn repo
apt-key adv --fetch-keys http://dl.yarnpkg.com/debian/pubkey.gpg
echo "deb http://nightly.yarnpkg.com/debian/ nightly main" > /etc/apt/sources.list.d/yarn.list

# Check if this is an old Ubuntu version that needs the NodeSource repo
if [ "$DISTRIB_RELEASE" == '14.04' ]; then
  apt-key adv --fetch-keys http://deb.nodesource.com/gpgkey/nodesource.gpg.key
  echo 'deb http://deb.nodesource.com/node_6.x trusty main' > /etc/apt/sources.list.d/nodesource.list
elif [ "$DISTRIB_RELEASE" == '12.04' ]; then
  apt-key adv --fetch-keys http://deb.nodesource.com/gpgkey/nodesource.gpg.key
  echo 'deb http://deb.nodesource.com/node_6.x precise main' > /etc/apt/sources.list.d/nodesource.list
fi;

apt-get update -y
# TODO: Remove ca-certificates from this list once https://github.com/yarnpkg/yarn/issues/1390 is fixed
apt-get install yarn ca-certificates -y

./run-yarn-test.sh
