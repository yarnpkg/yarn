#!/bin/bash
# Build script for continuous integration builds
set -ex

pushd `dirname $(readlink -f $0)/`/..

if [ "$CIRCLE_BRANCH" == 'master' ]; then
  original_version=`node -p "require('./package.json').version"`
  # Set a nice build number when building master on CircleCI
  # (eg. "0.16.0-alpha.123+20161018")
  version="$original_version-alpha.$CIRCLE_BUILD_NUM+"`date +%Y%m%d`
  YARN_VERSION_GIT_TAG=false yarn version --new-version $version
fi;

node -v
npm run lint
npm run test-ci
npm run check-lockfile
npm run build-dist
node ./scripts/build-webpack.js
./scripts/build-deb.sh
popd
