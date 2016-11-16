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

cd /tmp
mkdir yarntest
cd yarntest
echo {} > package.json
yarn add react || fail_with_log
