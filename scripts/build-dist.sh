#!/bin/bash
set -ex
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

rm -rf artifacts dist
rm -rf dist
mkdir artifacts
mkdir dist{,/bin,/lib}

# Workaround for https://github.com/yarnpkg/yarn/issues/2591
eval $system_yarn run build
eval $system_yarn run build-bundle
chmod +x artifacts/*.js

cp package.json dist/
cp README.md dist/
cp LICENSE dist/
cp artifacts/yarn-legacy-*.js dist/lib/yarn-cli.js
cp bin/yarn-bundle-entry.js dist/bin/yarn.js
cp bin/{yarn,yarnpkg,*.cmd} dist/bin/
# We cannot bundle v8-compile-cache as it must be loaded separately to be effective.
cp node_modules/v8-compile-cache/v8-compile-cache.js dist/lib/v8-compile-cache.js

version=`exec $dist_yarn --version`
./scripts/update-dist-manifest.js $(readlink -f dist/package.json) tar
tar -cvzf artifacts/yarn-v$version.tar.gz dist/*
