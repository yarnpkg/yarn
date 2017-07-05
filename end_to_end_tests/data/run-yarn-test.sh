#!/bin/bash
# Executed within a fresh Docker container to test execution of Yarn.
# Should be executed after Yarn has been installed.
set -ex

fail_with_log() {
  # Include the yarn-error.log file in the output, if available
  exitcode=$?
  if [ -s yarn-error.log ]; then
    cat yarn-error.log
  fi;
  exit $exitcode
}

check_config() {
  XDG_CONFIG_HOME=~/config_path yarn config get $1 > config_output
  echo $2 | diff config_output - || fail_with_log
}

cd /tmp
mkdir yarntest
cd yarntest
echo {} > package.json

# Create the cache directory and remove it
# This simulates issue reported here: https://github.com/yarnpkg/yarn/issues/1724
yarn --version || fail_with_log
rm -rf ~/.cache/yarn

yarn add react || fail_with_log

# Ensure that we follow the xdg spec
mkdir ~/config_path
echo "foo bar" > ~/config_path
check_config foo bar

# Ensure that compatibility with the old config format is maintained
echo "bar baz" >> ~/.yarnrc
check_config bar baz
