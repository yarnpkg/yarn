#!/bin/bash
# Pushes the latest Yarn version to Homebrew

set -ex

version=`curl --fail https://yarnpkg.com/latest-version`

# Ensure Linuxbrew is on the PATH
PATH=$PATH:$HOME/.linuxbrew/bin/
# Ensure homebrew-core is pointing to Homebrew rather than Linuxbrew
pushd ~/.linuxbrew/Library/Taps/homebrew/homebrew-core
#git remote set-url origin https://github.com/Daniel15/homebrew-core # for testing
git remote set-url origin https://github.com/homebrew/homebrew-core
# Remove any existing branch (eg. if the previous attempt failed)
git branch -D yarn-$version || true
popd

# Grab latest Yarn release so we can hash it
url=https://yarnpkg.com/downloads/$version/yarn-v$version.tar.gz
tempfile=`mktemp -t 'yarn-release-XXXXXXXX.tar.gz'`
curl --fail -L -o $tempfile $url
hash=`sha256sum $tempfile | head -c 64`

# Update the formula!
# "BROWSER=/bin/true" is a hack around https://github.com/Homebrew/brew/issues/2468
BROWSER=/bin/true brew bump-formula-pr --strict yarn --url=$url --sha256=$hash --message="This PR was automatically created via a script. Contact @Daniel15 with any questions."
