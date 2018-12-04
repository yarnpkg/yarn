#!/bin/bash
# Pushes the latest Yarn version to Homebrew

set -ex

if [ "$YARN_RC" = "true" ]; then
  echo 'This is an RC release; Homebrew will not be updated.'
  exit 0
fi;

# See if YARN_VERSION was passed in the environment, otherwise get version
# number from Yarn site
if [ -z "$YARN_VERSION" ]; then
  echo 'Getting Yarn version from https://yarnpkg.com/latest-version'
  version=`curl --compressed --fail https://yarnpkg.com/latest-version`
else
  version="$YARN_VERSION"
fi

# Ensure Linuxbrew is on the PATH
PATH=$PATH:$HOME/.linuxbrew/bin/
# Ensure homebrew-core is pointing to Homebrew rather than Linuxbrew
pushd ~/.linuxbrew/Library/Taps/homebrew/homebrew-core
git checkout master
git clean -fd
# Remove any existing branch (eg. if the previous attempt failed)
git branch -D yarn-$version || true

#git remote set-url origin https://github.com/Daniel15/homebrew-core # for testing
git remote set-url origin https://github.com/homebrew/homebrew-core
git fetch --prune origin
# Use `git reset` instead of pull since we don't want a merge etc., we just want
# local master to exactly reflect origin/master
git reset --hard origin/master
git clean -fd
popd

# Grab latest Yarn release so we can hash it
url=https://yarnpkg.com/downloads/$version/yarn-v$version.tar.gz
tempfile=`mktemp -t 'yarn-release-XXXXXXXX.tar.gz'`
curl --compressed --fail -L -o $tempfile $url
hash=`sha256sum $tempfile | head -c 64`

# Update the formula!
brew bump-formula-pr --strict yarn --url=$url --sha256=$hash --message="This PR was automatically created via a script. Contact @Daniel15 with any questions." --no-browse
