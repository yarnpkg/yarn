#!/usr/bin/env node

/**
 * If your node script has the above shebang, then npm install will
 * automatically create a windows .cmd for it.
 */

var path = require('path');
var fs = require('fs');
var os = require('os');

/**
 * This file is only to be used as an npm `"install": "esybuild"` hook.
 *
 * It is useless when using `esy` directly as a build entrypoint such as `esy
 * build`, however it is compatible with that workflow - it is simply a way to
 * invoke that `esy build` command at the right time after package contents
 * have been placed on disk.
 *
 * So therefore, we detect if we are part of some other `esy install` command
 * that we might make use of one day.
 */
if (process.env['esy__installing']) {
  return 0;
}

/**
 * The technique implemented here does not currently work in yarn, so yarn
 * users will have to run a separate build command after their `yarn install`.
 * Specifically, they will have to run ./node_modules/.bin/esy build.
 */
if (process.env['npm_config_user_agent' === 'yarn']) {
  return 0;
}

/**
 * In install, write out a postinstall ".hook" into
 * node_modules/.hooks/postinstall. This is a special script that is considered
 * by npm, and ran after *every* packages' `postinstall` step! That allows us
 * to trap the final postinstall step.
 *
 * It writes PACKAGENAME="myTopPackage"
 * That postinstall bash script that was written out checks if
 * process.env['npm_package_name'] = "$PACKAGENAME" and only then
 * runs esy build.
 */

var isPosix = true;

var postInstallContents;
if (isPosix) {
  postInstallContents =  [
    '#!/usr/bin/env bash',
    'if [ "$npm_package_name" == "$WAITING_FOR_PACKAGE_POST_INSTALL" ]; then',
    '  esy build',
    'fi'
  ].join(os.EOL);
} else {
  throw new Exception("non-POSIX systems not yet supported.")
}

/**
 * For transitive dependencies, this will not be *installed* for dependencies,
 * only the top level package, but it doesn't make sense why -
 *
 * Experiments:
 * Local modules "file:../" style, create nested node modules like:
 *
 *   node_modules/dep/node_modules
 *
 * If those nested modules *also* use this same esybuild script, they will be
 * injecting their `.hooks` into their deeper node_modules, and that's okay,
 * because npm won't run *that* `.hooks`. What we need to test now, is if
 * non-nested node_modules installs will cause problems because they all share
 * the same node_modules/.hooks directory.
 *
 * With the way the npm-hooks utility works (below), it should clober whatever
 * whatever is written there, and the top packages' `"install"` command should
 * be ran last. The only edge case is if somehow the top package's install
 * script somehow fails and can't clobber the ones dependencies wrote into
 * `node_modules/.hooks`.
 */
require('./npm-hooks').postinstall(postInstallContents, '.', function(err) {
  if (err) {
    console.log("ERROR INJECTING esy npm hook", err);
  }
});

