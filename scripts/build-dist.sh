#!/bin/bash
set -Exu
set -o pipefail
# Builds the release tarball for Yarn.

umask 0022 # Ensure permissions are correct (0755 for dirs, 0644 for files)

# Workaround for https://github.com/yarnpkg/yarn/issues/2591
case "$(uname -s)" in
  *CYGWIN*|MSYS*|MINGW*)
    dist_yarn=dist/bin/yarn.cmd
    system_yarn=yarn.cmd
    ;;
  *)
    dist_yarn=dist/bin/yarn
    system_yarn=yarn
    ;;
esac

version=`node -e "console.log(JSON.parse(fs.readFileSync('package.json')).version)"`

rm -rf artifacts dist
mkdir artifacts
mkdir dist{,/bin,/lib}

# Workaround for https://github.com/yarnpkg/yarn/issues/2591
eval $system_yarn run build
eval $system_yarn run build-bundle
chmod +x artifacts/*.js
# Verify that it works as expected
[[ "$version" == $(node artifacts/yarn-legacy-$version.js --version) ]] || exit 1
[[ "$version" == "$(node artifacts/yarn-$version.js --version)" ]] || exit 1

cp package.json dist/
cp README.md dist/
cp LICENSE dist/
cp artifacts/yarn-legacy-$version.js dist/lib/yarn-legacy.js
cp artifacts/yarn-$version.js dist/lib/yarn.js
cp bin/{yarn.js,yarn,yarnpkg,*.cmd} dist/bin/
chmod +x dist/bin/*

# We cannot bundle v8-compile-cache as it must be loaded separately to be effective.
cp node_modules/v8-compile-cache/v8-compile-cache.js dist/lib/v8-compile-cache.js

# Verify that it works as expected
[[ "$version" == "$(./dist/bin/yarn --version)" ]] || exit 1;

./scripts/update-dist-manifest.js $(readlink -f dist/package.json) tar
tar -cvzf artifacts/yarn-v$version.tar.gz dist/*
