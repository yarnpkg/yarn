#!/bin/bash

set -ex

npm version minor
VERSION=$(node -p -e "require('./package.json').version")
BRANCH=$(echo "$VERSION" | (IFS="."; read a b c && echo $a.$b-stable))
echo "$BRANCH"
git checkout -b "$BRANCH"
git push origin master --follow-tags
git push origin "$BRANCH" --follow-tags
