/**
 * @flow
 */

import type {MakeItem, MakeRawItem, MakeDefine, MakeRule} from '../Makefile';
import type {Sandbox, PackageInfo} from '../Sandbox';
import type {EnvironmentGroup} from '../PackageEnvironment';

const mkdirp = require('mkdirp').sync;
const childProcess = require('child_process');
const fs = require('fs');
const crypto  = require('crypto');
const path = require('path');
const outdent = require('outdent');
const {flattenArray} = require('../Utility');

const RUNTIME = fs.readFileSync(require.resolve('./runtime.sh'), 'utf8');

const {
  traversePackageDependencyTree,
  collectTransitiveDependencies,
  packageInfoKey,
} = require('../Sandbox');
const PackageEnvironment = require('../PackageEnvironment');
const Makefile = require('../Makefile');

const curWorkingDirectory = process.cwd();

function buildEjectCommand(
  sandbox: Sandbox,
  ...args: Array<string>
) {

  let defaultEjectDirectory = path.join(sandbox.packageInfo.rootDirectory, '_esy');
  let [
    ejectDirectory = defaultEjectDirectory
  ] = args;

  function emitFile(file: {filename: Array<string>; contents: string, executable?: boolean}) {
    let filename = path.join(ejectDirectory, ...file.filename);
    console.log('ejecting:', path.relative(curWorkingDirectory, filename));
    mkdirp(path.dirname(filename));
    fs.writeFileSync(filename, file.contents);
    if (file.executable) {
      let mode = fs.constants.S_IRWXU;
      fs.chmodSync(filename, mode);
    }
  }

  let sandboxPackageName = sandbox.packageInfo.packageJson.name;

  let sandboxPath = (packageInfo, tree: '_install' | '_build' | '_insttmp', ...path) => {
    let packageName = packageInfo.packageJson.name;
    let packageKey = packageInfoKey(sandbox.env, packageInfo);
    let isRootPackage = packageName === sandbox.packageInfo.packageJson.name;
    if (isRootPackage) {
      return ['$ESY__SANDBOX', tree, ...path].join('/');
    }
    return ['$ESY__STORE', tree, packageKey, ...path].join('/');
  };

  let sourcePath = (packageInfo) => {
    let isRootPackage = packageInfo.packageJson.name === sandbox.packageInfo.packageJson.name;
    if (isRootPackage) {
      return '$ESY__SANDBOX';
    } else {
      let rel = path.relative(sandbox.packageInfo.rootDirectory, packageInfo.rootDirectory);
      return `$ESY__SANDBOX/${rel}`;
    }
  };

  let buildPath = (packageInfo, ...path) =>
    sandboxPath(packageInfo, '_build', ...path);

  let installPath = (packageInfo, ...path) =>
    sandboxPath(packageInfo, '_install', ...path);

  let installTmpPath = (packageInfo, ...path) =>
    sandboxPath(packageInfo, '_insttmp', ...path);

  let prelude: Array<MakeDefine | MakeRawItem> = [

    {
      type: 'raw',
      value: `SHELL = ${sandbox.env.SHELL}`,
    },

    // ESY__ROOT is the root directory of the ejected Esy build
    // environment.
    {
      type: 'raw',
      value: 'ESY__ROOT := $(dir $(realpath $(lastword $(MAKEFILE_LIST))))'
    },

    // ESY__STORE is the directory where build artifacts should be stored.
    {
      type: 'raw',
      value: 'ESY__STORE ?= $(HOME)/.esy',
    },

    // ESY__SANDBOX is the sandbox directory, the directory where the root
    // package resides.
    {
      type: 'raw',
      value: 'ESY__SANDBOX ?= $(CURDIR)',
    },

  ];

  let rules: Array<MakeItem> = [

    // These are public API

    {
      type: 'rule',
      target: 'build',
      phony: true,
      dependencies: [`${sandboxPackageName}.build`],
    },
    {
      type: 'rule',
      target: 'build-shell',
      phony: true,
      dependencies: [`${sandboxPackageName}.shell`],
    },
    {
      type: 'rule',
      target: 'clean',
      phony: true,
      command: 'rm -rf $(ESY__SANDBOX)/_build $(ESY__SANDBOX)/_install $(ESY__SANDBOX)/_insttmp',
    },

    // Create store directory structure
    {
      type: 'rule',
      target: '$(ESY__STORE)/_install $(ESY__STORE)/_build $(ESY__STORE)/_insttmp',
      command: 'mkdir -p $(@)',
    },
    {
      type: 'rule',
      target: 'esy-store',
      phony: true,
      dependencies: ['$(ESY__STORE)/_install',  '$(ESY__STORE)/_build', '$(ESY__STORE)/_insttmp'],
    },
    {
      type: 'rule',
      target: '$(ESY__ROOT)/bin/realpath',
      dependencies: ['$(ESY__ROOT)/bin/realpath.c'],
      shell: '/bin/bash',
      command: 'gcc -o $(@) -x c $(<) 2> /dev/null',
    },
    {
      type: 'rule',
      target: 'esy-root',
      phony: true,
      dependencies: ['$(ESY__ROOT)/bin/realpath'],
    },
  ];

  traversePackageDependencyTree(
    sandbox.packageInfo,
    (packageInfo) => {
      let {normalizedName, packageJson, rootDirectory} = packageInfo;
      let isRootPackage = packageJson.name === sandboxPackageName;
      let buildHash = packageInfoKey(sandbox.env, packageInfo);

      let packagePath = isRootPackage
        ? []
        : path.relative(sandbox.packageInfo.rootDirectory, rootDirectory).split(path.sep);

      let buildCommand: ?string = null;
      if (packageJson.esy.build != null) {
        if (Array.isArray(packageJson.esy.build)) {
          buildCommand = packageJson.esy.build.join(' && ');
        } else {
          buildCommand = packageJson.esy.build;
        }
      }

      function emitPackageFile({filename, contents}) {
        emitFile({filename: packagePath.concat(filename), contents});
      }

      function definePackageRule(rule: {
        target: string;
        dependencies?: Array<string>;
        command?: ?string;
      }) {
        let {
          target,
          command,
          dependencies = []
        } = rule;
        rules.push({
          type: 'rule',
          target: packageTarget(target),
          dependencies: ['esy-store', 'esy-root', ...dependencies],
          phony: true,
          command: [
            outdent`
              $(shell_env_for__${normalizedName}) source $(ESY__ROOT)/bin/runtime.sh
              cd $esy_build__source_root
            `,
            command,
          ]
        });
      }

      function packageTarget(target, packageName = packageJson.name) {
        return `${packageName}.${target}`;
      }

      let buildEnvironment = PackageEnvironment.calculateEnvironment(
        sandbox,
        packageInfo,
        {installDirectory: installTmpPath(packageInfo)}
      );

      let dependencies = Object
        .keys(packageInfo.dependencyTree)
        .map(dep => packageTarget('build', dep));

      let allDependencies = collectTransitiveDependencies(packageInfo);

      let packageEnv = `${packageJson.name}__env`;

      emitPackageFile({
        filename: 'env',
        contents: renderEnv(buildEnvironment),
      });

      let findLibDestination =
        installTmpPath(packageInfo, 'lib');

      // Note that some packages can query themselves via ocamlfind during its
      // own build, this is why we include `findLibDestination` in the path too.
      let findLibPath =
        allDependencies.map(dep => installPath(dep, 'lib'))
        .concat(findLibDestination)
        .join(':');

      emitPackageFile({
        filename: 'findlib.conf.in',
        contents: outdent`
          path = "${findLibPath}"
          destdir = "${findLibDestination}"
          ldconf = "ignore"
          ocamlc = "ocamlc.opt"
          ocamldep = "ocamldep.opt"
          ocamldoc = "ocamldoc.opt"
          ocamllex = "ocamllex.opt"
          ocamlopt = "ocamlopt.opt"
        `
      });

      // Generate macOS sandbox configuration (sandbox-exec command)
      // TODO: Right now the only thing this sandbox configuration does is it
      // disallows writing into locations other than $cur__root,
      // $cur__target_dir and $cur__install. We should implement proper out of
      // source builds and also disallow $cur__root.
      // TODO: Try to use (deny default) and pick a set of rules for builds to
      // proceed (it chokes on xcodebuild for now if we disable reading "/" and
      // networking).
      emitPackageFile({
        filename: 'sandbox.sb.in',
        contents: outdent`
          (version 1.0)
          (allow default)

          (deny file-write*
            (subpath "/"))

          (allow file-write*
            (literal "/dev/null")

            (subpath "$TMPDIR_GLOBAL")
            (subpath "$TMPDIR")

            ; cur__root
            ; We don't really need to write into cur__root but some build systems
            ; can put .merlin files there so we allow that.
            (subpath "${sourcePath(packageInfo)}")

            ; cur__target_dir
            (subpath "${buildPath(packageInfo)}")

            ; cur__install
            (subpath "${installTmpPath(packageInfo)}")
          )

          (deny file-write*
            (subpath "${sourcePath(packageInfo)}/node_modules")
          )
        `
      });

      rules.push({
        type: 'define',
        name: `shell_env_for__${normalizedName}`,
        value: [
          {
            'CI': process.env.CI ? process.env.CI : null,
            'TMPDIR': '$(TMPDIR)',
            'ESY__STORE': '$(ESY__STORE)',
            'ESY__SANDBOX': '$(ESY__SANDBOX)',
            'ESY__ROOT': '$(ESY__ROOT)',
          },
          `source $(ESY__ROOT)/${packagePath.join('/')}/env`,
          {
            'esy_build__eject': `$(ESY__ROOT)/${packagePath.join('/')}`,
            'esy_build__type': packageInfo.packageJson.esy.buildsInSource
              ? 'in-source'
              : 'out-of-source',
            'esy_build__key': buildHash,
            'esy_build__source': packageInfo.source,
            'esy_build__source_type': packageInfo.sourceType,
            'esy_build__command': buildCommand || 'true',
            'esy_build__source_root': sourcePath(packageInfo),
            'esy_build__install': installPath(packageInfo),
          },
        ],
      });

      definePackageRule({
        target: 'clean',
        command: 'esy-clean'
      });

      definePackageRule({
        target: 'shell',
        dependencies,
        command: 'esy-shell'
      });

      definePackageRule({
        target: 'build',
        dependencies,
        command: 'esy-build'
      });
    });

  let allRules = [].concat(prelude).concat(rules);

  emitFile({
    filename: ['bin', 'realpath.c'],
    contents: outdent`
      #include<stdlib.h>

      main(int cc, char**vargs) {
        puts(realpath(vargs[1], 0));
        exit(0);
      }
    `,
  });

  emitFile({
    filename: ['bin/render-env'],
    executable: true,
    contents: outdent`
      #!/bin/bash

      set -e
      set -o pipefail

      _TMPDIR_GLOBAL=$($ESY__ROOT/bin/realpath "/tmp")

      if [ -d "$TMPDIR" ]; then
        _TMPDIR=$($ESY__ROOT/bin/realpath "$TMPDIR")
      else
        _TMPDIR="/does/not/exist"
      fi

      sed \\
        -e "s|\\$ESY__STORE|$ESY__STORE|g"          \\
        -e "s|\\$ESY__SANDBOX|$ESY__SANDBOX|g"      \\
        -e "s|\\$TMPDIR_GLOBAL|$_TMPDIR_GLOBAL|g"   \\
        -e "s|\\$TMPDIR|$_TMPDIR|g"                 \\
        $1 > $2
    `
  });

  emitFile({
    filename: ['bin/replace-string'],
    executable: true,
    contents: outdent`
      #!/usr/bin/env python

      import sys
      import os
      import stat

      filename, src, dest = sys.argv[1:4]
      filename_stage = filename + '.esy_rewrite'

      filestat = os.stat(filename)

      # TODO: we probably should handle symlinks too in a special way,
      # to modify their location to a rewritten path

      with open(filename, 'r') as input_file:
        data = input_file.read()

      data = data.replace(src, dest)

      with open(filename_stage, 'w') as output_file:
        output_file.write(data)

      os.rename(filename_stage, filename)
      os.chmod(filename, stat.S_IMODE(filestat.st_mode))
    `
  });

  emitFile({
    filename: ['bin', 'runtime.sh'],
    contents: RUNTIME
  });

  emitFile({
    filename: ['Makefile'],
    contents: Makefile.renderMakefile(allRules),
  });
}

function hash(value: string): string {
  return crypto.createHash('sha1').update(value).digest('hex');
}

function renderEnv(groups: Array<EnvironmentGroup>): string {
  let env = flattenArray(groups.map(group => group.envVars));
  return env
    .filter(env => env.value != null)
    // $FlowFixMe: make sure env.value is refined above
    .map(env => `export ${env.name}="${env.value}";`)
    .join('\n');
}

module.exports = buildEjectCommand;
