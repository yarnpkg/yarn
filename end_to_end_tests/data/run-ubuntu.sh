#!/bin/bash
# Executed within a fresh Docker container to test installation and execution of Yarn.
set -ex

. /etc/lsb-release

# Set proxy if one was passed in (eg. if caching on the host machine using apt-cacher-ng)
if [ -n "$APT_PROXY" ]; then
    echo 'Acquire::http::proxy "http://'$APT_PROXY'";' > /etc/apt/apt.conf.d/02proxy
fi;

# Add Yarn repo
apt-key adv --keyserver pgp.mit.edu --recv D101F7899D41F3C3
echo "deb http://nightly.yarnpkg.com/debian/ nightly main" > /etc/apt/sources.list.d/yarn.list
apt-get update -y

if [ "$DISTRIB_RELEASE" == '12.04' -o "$DISTRIB_RELEASE" == '14.04' ]; then
  # This is an old Ubuntu version; we need to add the NodeSource repo too
  apt-get install curl -y
  curl -sL https://deb.nodesource.com/setup_6.x | bash -
fi;

# TODO: Remove ca-certificates from this list once https://github.com/yarnpkg/yarn/issues/1390 is fixed
apt-get install yarn ca-certificates -y

./run-yarn-test.sh
