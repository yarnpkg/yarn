#!/usr/bin/env node
// Shebang (#!) above allows for invoking this file directly on Unix-like platforms.

/* eslint-disable no-var */
/* eslint-disable flowtype/require-valid-file-annotation */

/**
 * Entrypoint file loading Yarn cli tool:
 *  • This file must be written in ES5, as it isn't transpiled by Babel.
 */
'use strict';

// Node's version support check
var version = process.versions.node;
var majorVersion = parseInt(version.split('.')[0], 10);
if (majorVersion < 4) {
  console.error('Node version ' + version + ' is not supported, please use Node.js 4.0 or higher.');
  process.exit(1); // eslint-disable-line no-process-exit
}

// Increase perfomance by speeding up instantiation time using V8's code cache through node's "vm" core module.
try {
  require(__dirname + '/../lib/v8-compile-cache.js');
} catch (err) {
  // We don't have/need this on legacy builds and dev builds
}

// `lib/cli` may be `lib/cli/index.js` or `lib/cli.js` depending on the build.
/* Issue - Just requiring the package will trigger a yarn run since the `require.main === module` check inside `cli/index.js`
 * will always be truthy when built with webpack (as the single bundeled file is the entrypoint).
 */
var cli = require(__dirname + '/../lib/cli');

/* Only in case the above require didn't trigger yarn execution. 
 * Basically a workaround check for the above mentioned issue when the code is built (Webpack bundled). 
 */
if (!cli.autoRun) {
  // Execute the module function as it won't be triggered automatically by requiring.
  cli.default().catch(function(error) {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}
