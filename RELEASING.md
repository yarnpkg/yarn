## To release a new version of Yarn

* Make sure current master branch is green on [Circle](https://circleci.com/gh/facebook/fbkpm) and [Travis](https://travis-ci.com/facebook/fbkpm/builds)
* `npm run release-branch`

## To patch existing version of Yarn

* Switch to released branch `get checkout 0.x-stable`, e.g 0.7-stable
* Cherry-pick fixes from master branch
* Tag the new release `npm version patch`, it will create a commit with changed package.json and tag `v0.xx.1` to that commit
* Push to origin `git push origin 0.x-stable --follow-tags`
