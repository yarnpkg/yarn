/**
 * @flow
 */

let childProcess = require('child_process');

import chalk from 'chalk';
const PackageEnvironment = require('../PackageEnvironment');
const Sandbox = require('../Sandbox');

/**
 * Each package can configure exportedEnvVars with:
 *
 * (object key is environment variable name)
 *
 * val: string
 *
 * scope: In short:
 *    "local": Can be seen by this package at build time, shadows anything
 *    configured by dependencies.
 *    "export": Seen by immediate dependers during their build times, and
 *    shadows any global variables those immediate dependers can see at build
 *    time.
 *    "global": Seen by all packages that have a transitive linktime dependency
 *    on our package.
 *
 *    You can or them together: "local|export", "local|global".
 *
 * Example:
 *
 *   If you are publishing a binary to all transitive dependers, you'd do:
 *
 *     "PATH": {
 *       "val": "PATH:$PATH",
 *       "scope": "global"
 *     }
 *
 *   You wouldn't necessarily use a "local" scope because your package that
 *   builds the resulting binary doesn't care about seeing that binary.
 *
 *   Similarly, if you build library artifacts, you don't care about *seeing*
 *   those library artifacts as the library that is building them.
 *
 *
 *     "FINDLIB": {
 *       "val": "$MY_PACKAGE__LIB:$FINDLIB",
 *       "scope": "export"
 *     }
 *
 * VISIBILITY:
 * -------------
 *
 * Consider that a package my-compiler has defines a variable CC_FLAG. It would
 * normally publish some default flag with a "global" scope so that everyone
 * who transitively depends on it can see the default.
 *
 * "CC_FLAG": {
 *   "val": "-default-flag",
 *   "scope": "global"
 * }
 *
 * Then we want to be able to create a package `my-package` that depends on
 * `my-compiler`, which wants to override those flags for its own package
 * compilation - so it sets the scope flag to "local". The local scope
 * shadows the global scope, and the new value is only observed by
 * `my-package`.
 *
 * "CC_FLAG": {
 *   "val": "-opt 0",
 *   "scope": "local"
 * }
 *
 * In the same way that let bindings shadow global bindings, yet can reference
 * the global one in the definition of the local one, the same is true of local
 * environment variables.
 *
 *   let print_string = fun(s) => print_string(s + "!!!");
 *
 *   // Analogous to
 *   "CC_FLAG": {
 *     "val": "-opt 0 $CC_FLAG",
 *     "scope": "local"
 *   }
 *
 *
 * Local scopes allow us to create a package `my-app` that depends on
 * `my-package` (which in turn depends on `my-compiler`) such that `my-app`
 * doesn't observe the conpiler flags that its dependency (`my-package`) used.
 *
 * Though, in other cases, we *do* want configured flags to be visible.
 * Imagine making a package called `add-opt-flags`, which only has a
 * `package.json` that configures optimized compiler flags. If you directly
 * depend on `add-opt-flags`, you get all the flags added to your package.
 * `add-opt-flags` would configure the variable like:
 *
 * "CC_FLAG": {
 *   "val": "-opt 3",
 *   "scope": "export"
 * }
 *
 * If `your-app` depends on `add-opt-flags`, you would get all the flags set by
 * `add-opt-flags`, but if `app-store` depends on `your-app`, `app-store`
 * wouldn't have opt flags added automatically.
 *
 *
 * Priority of scope visibility is as follows: You see the global scope
 * (consisting of all global variables set by your transitive dependencies)
 * then you see the exported scope of your direct dependencies, shadowing any
 * global scope and then you see your local scope, which shaddows everything
 * else. Each time you shadow a scope, you can reference the lower priority
 * scope *while* shadowing. Just like you can do the following in ML, to
 * redefine addition in terms of addition that was in global scope.
 *
 * A language analogy would be the assumption that every package has an implicit
 * "opening" of its dependencies' exports, to bring them into scope.
 *
 *   open GlobalScopeFromAllTransitiveRuntimeDependencies;
 *   open AllImmediateDependencies.Exports;
 *
 *   let myLocalVariable = expression(in, terms, of, everything, above);
 *
 * In fact, all of this configuration could/should be replaced by a real
 * language. The package builder would then just be something that concatenates
 * files together in a predictable order.
 *
 * WHO CAN WRITE:
 * -------------
 *
 *  When thinking about conflicts, it helps to recall that different scopes are
 *  actually writing to different locations that shadow in convenient ways.
 *  We need some way to control exclusivity of writing these env vars to prevent
 *  conflicts. The current implementaiton just has a single exclusive:
 *  true/false flag and it doesn't take into account scope.
 */

function formatError(message: string) {
  return `${chalk.red('ERROR')} ${message}`;
}

function error(message: string) {
  console.log(formatError(message));
  process.exit(1);
}

async function getValidSandbox(directory) {
  const sandbox = await Sandbox.fromDirectory(directory);
  if (sandbox.packageInfo.errors.length > 0) {
    sandbox.packageInfo.errors.forEach(error => {
      console.log(formatError(error.message));
    });
    process.exit(1);
  }
  return sandbox;
}

const builtInCommands = {
  "build-eject": async function(curDir, ...args) {
    let buildEject = require('../buildEjectCommand');
    const sandbox = await getValidSandbox(curDir);
    buildEject(sandbox, ...args);
  },
};

// TODO: Need to change this to climb to closest package.json.
const curDir = process.cwd();
const actualArgs = process.argv.slice(2);

async function main() {

  if (actualArgs.length === 0) {
    const sandbox = await getValidSandbox(curDir);
    // It's just a status command. Print the command that would be
    // used to setup the environment along with status of
    // the build processes, staleness, package validity etc.
    let envForThisPackageScripts = PackageEnvironment.calculateEnvironment(
      sandbox,
      sandbox.packageInfo,
      {useLooseEnvironment: true}
    );
    console.log(PackageEnvironment.printEnvironment(envForThisPackageScripts));
  } else {
    let builtInCommandName = actualArgs[0];
    let builtInCommand = builtInCommands[builtInCommandName];
    if (builtInCommand) {
      builtInCommand(curDir, ...process.argv.slice(3));
    } else {
      console.error(`unknown command: ${builtInCommandName}`);
    }
  }
}

main().catch(error);
