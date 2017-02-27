/**
 * @flow
 */

import type {
  Sandbox,
  PackageInfo,
  PackageJson,
  EnvironmentVarExport,
} from './Sandbox';

const path = require('path');
const pathIsInside = require('path-is-inside');
const fs = require('fs');
const os = require('os');
const {mapObject} = require('./Utility');
const {
  traversePackageDependencyTree,
  packageInfoKey,
  collectTransitiveDependencies
} = require('./Sandbox');

export type EnvironmentVar = {
  name: string;
  value: ?string;
  automaticDefault?: boolean;
};

export type EnvironmentGroup = {
  packageJsonPath: string;
  packageJson: PackageJson;
  envVars: Array<EnvironmentVar>;
  errors: Array<string>;
};

export type Environment = Array<EnvironmentGroup>;

type EnvironmentConfigState = {
  seenVars: {
    [name: string]: {
      packageJsonPath: string;
      config: EnvironmentVarExport;
    };
  };
  errors: Array<string>;
  normalizedEnvVars: Array<EnvironmentVar>;
};

// X platform newline
const EOL = os.EOL;
const delim = path.delimiter;

let globalGroups = [];
let globalSeenVars = {};

function extend(o, more) {
  var next = {};
  for (var key in o) {
    next[key]= o[key];
  }
  for (var key in more) {
    next[key]= more[key];
  }
  return next;
}

/**
 * Ejects a path for the sake of printing to a shell script/Makefile to be
 * executed on a different host. We therefore print it relative to an abstract
 * and not-yet-assigned $ESY__SANDBOX.
 *
 * This is the use case:
 *
 * 0. Run npm install.
 * 1. Don't build.
 * 3. Generate shell script/makefile.
 * 4. tar the entire directory with the --dereference flag.
 * 5. scp it to a host where node isn't even installed.
 * 6. untar it with the -h flag.
 *
 * All internal symlinks will be preserved. I *believe* --dereference will copy
 * contents if symlink points out of the root location (I hope).
 *
 * So our goal is to ensure that the locations we record point to the realpath
 * if a location is actually a symlink to somewhere in the sandbox, but encode
 * the path (including symlinks) if it points outside the sandbox.  I believe
 * that will work with tar --dereference.
 */
function relativeToSandbox(realFromPath, toPath) {
  /**
   * This sucks. If there's a symlink pointing outside of the sandbox, the
   * script can't include those, so it gives it from perspective of symlink.
   * This will work with tar, but there could be issues if multiple symlink
   * links all point to the same location, but appear to be different.  We
   * should execute a warning here instead. This problem is far from solved.
   * What would tar even do in that situation if it's following symlinks
   * outside of the tar directory? Would it copy it multiple times or copy it
   * once somehow?
   */
  let realToPath = fs.realpathSync(toPath);
  let toPathToUse = pathIsInside(realFromPath, realToPath)
    ? realToPath
    : toPath;
  let ret = path.relative(realFromPath, toPathToUse);
  return (ret == '0') ? "$esy__sandbox" : `$esy__sandbox/${ret}`;
}

function getScopes(config) {
  if (!config.scope) {
    return {};
  }
  var scopes = (config.scope || '').split('|');
  var scopeObj = {};
  for (var i = 0; i < scopes.length; i++) {
    scopeObj[scopes[i]] = true;
  }
  return scopeObj;
}

/**
 * Validates env vars that were configured in package.json as opposed to
 * automatically created.
 */
var validatePackageJsonExportedEnvVar = (envVar, config, inPackageName, envVarConfigPrefix) => {
  let beginsWithPackagePrefix = envVar.indexOf(envVarConfigPrefix) === 0;
  var ret = [];
  if (config.scopes !== undefined) {
    ret.push(
         envVar + " has a field 'scopes' (plural). You probably meant 'scope'. " +
        "The owner of " + inPackageName + " likely made a mistake"
    );
  }
  let scopeObj = getScopes(config);
  if (!scopeObj.global) {
    if (!beginsWithPackagePrefix) {
      if (envVar.toUpperCase().indexOf(envVarConfigPrefix) === 0) {
        ret.push(
            "It looks like " + envVar + " is trying to be configured as a package scoped variable, " +
            "but it has the wrong capitalization. It should begin with " + envVarConfigPrefix +
            ". The owner of " + inPackageName + " likely made a mistake"
        );
      } else {
        ret.push(
          "Environment variable " + envVar + " " +
            "doesn't begin with " + envVarConfigPrefix + " but it is not marked as 'global'. " +
            "You should either prefix variables with " + envVarConfigPrefix + " or make them global." +
            "The author of " + inPackageName + " likely made a mistake"
        );
      }
    }
  } else {
    // Else, it's global, but better not be trying to step on another package!
    if (!beginsWithPackagePrefix && envVar.indexOf("__") !== -1) {
      ret.push(
        envVar +
          " looks like it's trying to step on another " +
          "package because it has a double underscore - which is how we express namespaced env vars. " +
          "The package owner for " + inPackageName + " likely made a mistake"
      );
    }
  }
  return ret;
};

function builtInsPerPackage(
  sandbox: Sandbox,
  prefix: string,
  packageInfo: PackageInfo,
  installDirectory?: string
) {
  let {
    packageJson: {name, version, esy},
    rootDirectory,
    dependencyTree,
  } = packageInfo;
  let isRootPackage = name === sandbox.packageInfo.packageJson.name;
  function builtIn(val) {
    return {
      __BUILT_IN_DO_NOT_USE_OR_YOU_WILL_BE_PIPd: true,
      global: false,
      exclusive: true,
      val,
    }
  }
  return {
    [`${prefix}__name`]: builtIn(
      name
    ),
    [`${prefix}__version`]: builtIn(
      version || null
    ),
    [`${prefix}__root`]: builtIn(
      esy.buildsInSource
        ? targetPath(sandbox, packageInfo, '_build')
        : relativeToSandbox(sandbox.packageInfo.rootDirectory, rootDirectory)
    ),
    [`${prefix}__depends`]: builtIn(
      Object.keys(dependencyTree).join(' ')
    ),
    [`${prefix}__target_dir`]: builtIn(
      targetPath(sandbox, packageInfo, '_build')
    ),
    [`${prefix}__install`]: builtIn(
      installDirectory != null
        ? installDirectory
        : targetPath(sandbox, packageInfo, '_install')
    ),
    [`${prefix}__bin`]: builtIn(
      `$${prefix}__install/bin`
    ),
    [`${prefix}__sbin`]: builtIn(
      `$${prefix}__install/sbin`
    ),
    [`${prefix}__lib`]: builtIn(
      `$${prefix}__install/lib`
    ),
    [`${prefix}__man`]: builtIn(
      `$${prefix}__install/man`
    ),
    [`${prefix}__doc`]: builtIn(
      `$${prefix}__install/doc`
    ),
    [`${prefix}__stublibs`]: builtIn(
      `$${prefix}__install/stublibs`
    ),
    [`${prefix}__toplevel`]: builtIn(
      `$${prefix}__install/toplevel`
    ),
    [`${prefix}__share`]: builtIn(
      `$${prefix}__install/share`
    ),
    [`${prefix}__etc`]: builtIn(
      `$${prefix}__install/etc`
    ),
  };
}

function addEnvConfigForPackage(
  {seenVars, errors, normalizedEnvVars}: EnvironmentConfigState,
  realPathSandboxRootOnEjectingHost,
  packageName,
  packageJsonFilePath,
  exportedEnv
) {
  var nextSeenVars = {};
  var nextErrors = []
  var nextNormalizedEnvVars = [];
  for (var envVar in exportedEnv) {
    var config = exportedEnv[envVar];
    nextNormalizedEnvVars.push({
      name: envVar,
      value: config.val,
      automaticDefault: !!config.__BUILT_IN_DO_NOT_USE_OR_YOU_WILL_BE_PIPd
    })
    // The seenVars will only cover the cases when another package declares the
    // variable, not when it's loaded from your bashrc etc.
    if (seenVars[envVar] && seenVars[envVar].config.exclusive) {
      nextErrors.push(
        (seenVars[envVar].config.__BUILT_IN_DO_NOT_USE_OR_YOU_WILL_BE_PIPd ? 'Built-in variable ' : '') +
        envVar +
          " has already been set by " + relativeToSandbox(realPathSandboxRootOnEjectingHost, seenVars[envVar].packageJsonPath) + " " +
          "which configured it with exclusive:true. That means it wants to be the only one to set it. Yet " +
          packageName + " is trying to override it."
      );
    }
    if (seenVars[envVar] && (config.exclusive)) {
      nextErrors.push(
        envVar +
          " has already been set by " + relativeToSandbox(realPathSandboxRootOnEjectingHost, seenVars[envVar].packageJsonPath) + " " +
          "and " + packageName + " has configured it with exclusive:true. " +
          "Sometimes you can reduce the likehood of conflicts by marking some packages as buildTimeOnlyDependencies."
      );
    }
    nextSeenVars[envVar] = {
      packageJsonPath: packageJsonFilePath || 'unknownPackage',
      config
    };
  }
  return {
    errors: errors.concat(nextErrors),
    seenVars: extend(seenVars, nextSeenVars),
    normalizedEnvVars: normalizedEnvVars.concat(nextNormalizedEnvVars)
  };
}

function computeEnvVarsForPackage(
  sandbox: Sandbox,
  packageInfo: PackageInfo
) {
  let {rootDirectory, packageJson, normalizedName} = packageInfo;
  var packageJsonDir = path.dirname(rootDirectory);
  var packageName = packageJson.name;
  var envVarConfigPrefix = normalizedName;
  let errors = [];
  var autoExportedEnvVarsForPackage = builtInsPerPackage(
    sandbox,
    envVarConfigPrefix,
    packageInfo
  );

  let {
    seenVars,
    errors: nextErrors,
    normalizedEnvVars
  } = addEnvConfigForPackage(
    {seenVars: globalSeenVars, errors, normalizedEnvVars: []},
    sandbox.packageInfo.rootDirectory,
    packageName,
    rootDirectory,
    autoExportedEnvVarsForPackage
  );

  for (var envVar in packageJson.esy.exportedEnv) {
    nextErrors = nextErrors.concat(
      validatePackageJsonExportedEnvVar(
        envVar,
        packageJson.esy.exportedEnv[envVar],
        packageName,
        envVarConfigPrefix
      )
    );
  }

  let {
    seenVars: nextSeenVars,
    errors: nextNextErrors,
    normalizedEnvVars: nextNormalizedEnvVars
  } = addEnvConfigForPackage(
    {seenVars, errors: nextErrors, normalizedEnvVars},
    sandbox.packageInfo.rootDirectory,
    packageName,
    path.join(rootDirectory, 'package.json'),
    packageJson.esy.exportedEnv
  );

  /**
   * Update the global. Yes, we tried to be as functional as possible aside
   * from this.
   */
  globalSeenVars = nextSeenVars;
  globalGroups.push({
    root: relativeToSandbox(
      sandbox.packageInfo.rootDirectory,
      rootDirectory
    ),
    packageJsonPath: relativeToSandbox(
      sandbox.packageInfo.rootDirectory,
      path.join(rootDirectory, 'package.json')
    ),
    packageJson: packageJson,
    envVars: nextNormalizedEnvVars,
    errors: nextNextErrors
  })
}

function targetPath(sandbox, packageInfo, tree: '_install' | '_build', ...pathTo) {
  let packageName = packageInfo.packageJson.name;
  let packageSourceType = packageInfo.sourceType;
  let packageKey = packageInfoKey(sandbox.env, packageInfo);
  let isRootPackage = packageName === sandbox.packageInfo.packageJson.name;
  let isNonRootLocalPackage = packageSourceType === 'local';
  if (isRootPackage) {
    return ['$esy__sandbox', tree, ...pathTo].join('/');
  } else if (isNonRootLocalPackage) {
    return ['$esy__local_store', tree, packageKey, ...pathTo].join('/');
  }
  return ['$esy__store', tree, packageKey, ...pathTo].join('/');
}

type PackageEnvironmentOptions = {
  installDirectory?: string;
  useLooseEnvironment?: boolean;
};

/**
 * For a given package name within the package database, compute the environment
 * variable setup in terms of a hypothetical root.
 */
function calculateEnvironment(
  sandbox: Sandbox,
  packageInfo: PackageInfo,
  options: PackageEnvironmentOptions = {}
): Environment {
  /**
   * The root package.json path on the "ejecting host" - that is, the host where
   * the universal build script is being computed. Everything else should be
   * relative to this.
   */
  let curRootPackageJsonOnEjectingHost = packageInfo.rootDirectory;
  let currentlyBuildingPackageRoot = path.dirname(curRootPackageJsonOnEjectingHost);
  globalSeenVars = {};

  function setUpBuiltinVariables(envConfigState: EnvironmentConfigState) {
    let sandboxExportedEnvVars: {[name: string]: EnvironmentVarExport} = {
      'esy__sandbox': {
        val: '$ESY__SANDBOX',
        exclusive: true,
        __BUILT_IN_DO_NOT_USE_OR_YOU_WILL_BE_PIPd: true,
      },
      'esy__store': {
        val: '$ESY__STORE',
        exclusive: true,
        __BUILT_IN_DO_NOT_USE_OR_YOU_WILL_BE_PIPd: true,
      },
      'esy__local_store': {
        val: '$ESY__LOCAL_STORE',
        exclusive: true,
        __BUILT_IN_DO_NOT_USE_OR_YOU_WILL_BE_PIPd: true,
      },
      'esy__install_tree': {
        val: '$esy__sandbox/_install',
        exclusive: true,
        __BUILT_IN_DO_NOT_USE_OR_YOU_WILL_BE_PIPd: true,
      },
      'esy__build_tree': {
        val: '$esy__sandbox/_build',
        exclusive: true,
        __BUILT_IN_DO_NOT_USE_OR_YOU_WILL_BE_PIPd: true,
      },
      ...builtInsPerPackage(sandbox, 'cur', packageInfo, options.installDirectory),
      'OCAMLFIND_CONF': {
        val: '$cur__target_dir/_esy/findlib.conf',
        exclusive: false,
      },
    };

    let dependencies = collectTransitiveDependencies(packageInfo);
    if (dependencies.length > 0) {
      let depPath = dependencies
        .map(dep => targetPath(sandbox, dep, '_install', 'bin'))
        .join(':');
      let depManPath = dependencies
        .map(dep => targetPath(sandbox, dep, '_install', 'man'))
        .join(':');
      sandboxExportedEnvVars = Object.assign(sandboxExportedEnvVars, {
        'PATH': {
          val: `${depPath}:$PATH`,
          exclusive: false,
        },
        'MAN_PATH': {
          val: `${depManPath}:$MAN_PATH`,
          exclusive: false,
        }
      });
    }

    envConfigState = addEnvConfigForPackage(
      envConfigState,
      sandbox.packageInfo.rootDirectory,
      "EsySandBox",
      curRootPackageJsonOnEjectingHost,
      mapObject(options.useLooseEnvironment ? sandbox.looseEnv : sandbox.env, env => ({
        val: env,
        exclusive: false,
        __BUILT_IN_DO_NOT_USE_OR_YOU_WILL_BE_PIPd: false
      }))
    );
    envConfigState = addEnvConfigForPackage(
      envConfigState,
      sandbox.packageInfo.rootDirectory,
      "EsySandBox",
      curRootPackageJsonOnEjectingHost,
      sandboxExportedEnvVars
    );
    envConfigState = addEnvConfigForPackage(
      envConfigState,
      sandbox.packageInfo.rootDirectory,
      "EsySandBox",
      curRootPackageJsonOnEjectingHost,
      {}
    );

    return envConfigState;
  }

  try {
    let {
      seenVars,
      errors,
      normalizedEnvVars
    } = setUpBuiltinVariables({seenVars: globalSeenVars, errors: [], normalizedEnvVars: []});

    /**
     * Update the global. Sadly, haven't thread it through the
     * traversePackageTree.
     */
    globalSeenVars = seenVars;
    globalGroups = [{
      packageJsonPath: '',
      packageJson: {
        name: "EsySandboxVariables",
        esy: {
          build: null,
          buildsInSource: false,
          exportedEnv: {}
        }
      },
      envVars: normalizedEnvVars,
      errors: errors
    }];
    traversePackageDependencyTree(
      packageInfo,
      computeEnvVarsForPackage.bind(null, sandbox)
    );
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error("Fail to find package.json!: " + err.message);
    } else {
      throw err;
    }
  }

  var ret = globalGroups;

  globalGroups = [];
  globalSeenVars = {};

  return ret;
};

function printEnvironment(groups: Environment) {
  return groups.map(function(group) {
    let headerLines = [
      '',
      '# ' + group.packageJson.name + (group.packageJson.version ? '@' + (group.packageJson.version) : '') + ' ' +  group.packageJsonPath ,
    ];
    let renderingBuiltInsForGroup = false;
    let errorLines = group.errors.map(err => {
      return '# [ERROR] ' + err
    });
    let envVarLines = group.envVars
      .map(envVar => {
        if (envVar.value == null) {
          return null;
        }
        let exportLine = `export ${envVar.name}="${envVar.value}"`;
        if (!renderingBuiltInsForGroup && envVar.automaticDefault) {
          renderingBuiltInsForGroup = true;
          return ['# [BuiltIns]', exportLine ].join(EOL);
        } else if (renderingBuiltInsForGroup && !envVar.automaticDefault) {
          renderingBuiltInsForGroup = false;
          return ['# [Custom Variables]', exportLine ].join(EOL);
        } else {
          return exportLine;
        }
      })
      .filter(envVar => envVar != null);
    return headerLines.concat(errorLines).concat(envVarLines).join(EOL);
  }).join(EOL);
};

module.exports = {
  calculateEnvironment,
  printEnvironment,
};

/**
 * TODO: Cache this result on disk in a .reasonLoadEnvCache so that we don't
 * have to repeat this process.
 */
