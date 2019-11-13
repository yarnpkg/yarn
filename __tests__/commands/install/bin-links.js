/* @flow */

import * as fs from '../../../src/util/fs.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

const request = require('request');
const path = require('path');
const exec = require('child_process').exec;
import {runInstall} from '../_helpers.js';

async function linkAt(config, ...relativePath): Promise<string> {
  const joinedPath = path.join(config.cwd, ...relativePath);
  const stat = await fs.lstat(joinedPath);
  if (stat.isSymbolicLink()) {
    const linkPath = await fs.readlink(joinedPath);
    return linkPath;
  } else {
    const contents = await fs.readFile(joinedPath);
    return /node" +"\$basedir\/([^"]*\.js)"/.exec(contents)[1];
  }
}

function execCommand(cwd: string, binPath: Array<string>, args: Array<string>): Promise<Array<?string>> {
  const cmd = path.join(...binPath);

  return new Promise((resolve, reject) => {
    exec(
      `${cmd} ${args.join(' ')}`,
      {
        cwd,
        env: {
          ...process.env,
          YARN_WRAP_OUTPUT: 1,
        },
      },
      (error, stdout) => {
        if (error) {
          reject({error, stdout});
        } else {
          resolve(stdout.toString().split('\n').map(line => line.trim()).filter(line => line));
        }
      },
    );
  });
}

beforeEach(request.__resetAuthedRequests);
afterEach(request.__resetAuthedRequests);

test('install should hoist nested bin scripts', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-nested-bin', async config => {
    const binScripts = await fs.walk(path.join(config.cwd, 'node_modules', '.bin'));
    // need to triple the amount as windows makes 3 entries for each dependency
    // so for below, there would be an entry for eslint, eslint.cmd and eslint.ps1 on win32
    const amount = process.platform === 'win32' ? 20 : 10;
    expect(binScripts).toHaveLength(amount);

    expect(await linkAt(config, 'node_modules', '.bin', 'standard')).toEqual('../standard/bin/cmd.js');
    expect(await linkAt(config, 'node_modules', '.bin', 'eslint')).toEqual('../eslint/bin/eslint.js');
  });
});

// dependency tree:
//   eslint@3.7.0
//   standard
//   standard -> eslint@3.7.1
// result should be:
//   eslint 3.7.0 is linked in /.bin because it takes priority over the transitive 3.7.1
//   eslint 3.7.1 is linked in standard/node_modules/.bin
test('direct dependency bin takes priority over transitive bin', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-duplicate-bin', async config => {
    expect(await linkAt(config, 'node_modules', '.bin', 'eslint')).toEqual('../eslint/bin/eslint.js');
    expect(await linkAt(config, 'node_modules', 'standard', 'node_modules', '.bin', 'eslint')).toEqual(
      '../eslint/bin/eslint.js',
    );
    const stdout = await execCommand(config.cwd, ['node_modules', '.bin', 'eslint'], ['--version']);
    expect(stdout[0]).toEqual('v3.7.0');
  });
});

test('install should respect --no-bin-links flag', (): Promise<void> => {
  return runInstall({binLinks: false}, 'install-nested-bin', async config => {
    const binExists = await fs.exists(path.join(config.cwd, 'node_modules', '.bin'));
    expect(binExists).toBeFalsy();
  });
});

// Scenario: Transitive dependency having version that is overridden by newer version as the direct dependency.
// Behavior: eslint@3.12.2 is symlinked in node_modules/.bin
//           and eslint@3.10.1 is symlinked to node_modules/sample-dep-eslint-3.10.1/node_modules/.bin
test('newer transitive dep is overridden by newer direct dep', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-bin-links-newer', async config => {
    expect(await linkAt(config, 'node_modules', '.bin', 'eslint')).toEqual('../eslint/bin/eslint.js');
    expect(await linkAt(config, 'node_modules', 'sample-dep-eslint-3.10.1', 'node_modules', '.bin', 'eslint')).toEqual(
      '../eslint/bin/eslint.js',
    );
    const stdout = await execCommand(config.cwd, ['node_modules', '.bin', 'eslint'], ['--version']);
    expect(stdout[0]).toEqual('v3.12.2');
  });
});

// Scenario: Transitive dependency having version that is overridden by older version as the direct dependency.
// Behavior: eslint@3.10.1 is symlinked in node_modules/.bin
//           and eslint@3.12.2 is symlinked to node_modules/sample-dep-eslint-3.12.2/node_modules/.bin
test('newer transitive dep is overridden by older direct dep', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-bin-links-older', async config => {
    expect(await linkAt(config, 'node_modules', '.bin', 'eslint')).toEqual('../eslint/bin/eslint.js');
    expect(await linkAt(config, 'node_modules', 'sample-dep-eslint-3.12.2', 'node_modules', '.bin', 'eslint')).toEqual(
      '../eslint/bin/eslint.js',
    );
    const stdout = await execCommand(config.cwd, ['node_modules', '.bin', 'eslint'], ['--version']);
    expect(stdout[0]).toEqual('v3.10.1');
  });
});

// Scenario: Transitive dependency having version that is conflicting with another transitive dependency version.
// Behavior: eslint@3.10.1 is symlinked in node_modules/.bin
//           and eslint@3.12.2 is symlinked to node_modules/sample-dep-eslint-3.12.2/node_modules/.bin.
//           Here it seems like NPM add the modules in alphabetical order
//           and transitive deps of first dependency is installed at top level.
test('first transient dep is installed when same level and reference count', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-bin-links-conflicting', async config => {
    expect(await linkAt(config, 'node_modules', '.bin', 'eslint')).toEqual('../eslint/bin/eslint.js');
    expect(await linkAt(config, 'node_modules', 'sample-dep-eslint-3.12.2', 'node_modules', '.bin', 'eslint')).toEqual(
      '../eslint/bin/eslint.js',
    );
    const stdout = await execCommand(config.cwd, ['node_modules', '.bin', 'eslint'], ['--version']);
    expect(stdout[0]).toEqual('v3.10.1');
  });
});

// Scenario: Transitive dependency having version that is conflicting with another dev transitive dependency version.
// Behavior: eslint@3.10.1 is symlinked in node_modules/.bin
//           and eslint@3.12.2 is symlinked to node_modules/sample-dep-eslint-3.12.2/node_modules/.bin.
//           Whether the dependencies are devDependencies or not does not seem to matter to NPM.
test('first dep is installed when same level and reference count and one is a dev dep', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-bin-links-conflicting-dev', async config => {
    expect(await linkAt(config, 'node_modules', '.bin', 'eslint')).toEqual('../eslint/bin/eslint.js');
    expect(await linkAt(config, 'node_modules', 'sample-dep-eslint-3.12.2', 'node_modules', '.bin', 'eslint')).toEqual(
      '../eslint/bin/eslint.js',
    );
    const stdout = await execCommand(config.cwd, ['node_modules', '.bin', 'eslint'], ['--version']);
    expect(stdout[0]).toEqual('v3.10.1');
  });
});

// Scenario: Transitive dependency having bin link with a name that's conflicting with that of a direct dependency.
// Behavior: a-dep and b-dep is linked in node_modules/.bin rather than c-dep and d-dep
test('direct dependency is linked when bin name conflicts with transitive dependency', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-bin-links-conflicting-names', async config => {
    const stdout1 = await execCommand(config.cwd, ['node_modules', '.bin', 'binlink1'], []);
    const stdout2 = await execCommand(config.cwd, ['node_modules', '.bin', 'binlink2'], []);
    expect(stdout1[0]).toEqual('direct a-dep');
    expect(stdout2[0]).toEqual('direct f-dep');
  });
});

// fixes https://github.com/yarnpkg/yarn/issues/3535
// quite a heavy test, did not find a way to isolate
test('Only top level (after hoisting) bin links should be linked', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-bin-links-eslint', async config => {
    expect(await linkAt(config, 'node_modules', '.bin', 'eslint')).toEqual('../eslint/bin/eslint.js');
    const stdout = await execCommand(config.cwd, ['node_modules', '.bin', 'uglifyjs'], ['--version']);
    expect(stdout[0]).toEqual('uglify-js 3.0.14');
  });
});

// fixes https://github.com/yarnpkg/yarn/issues/5876
test('can use link protocol to install a package that would not be found via node module resolution', (): Promise<
  void,
> => {
  return runInstall({binLinks: true}, {source: 'install-link-siblings', cwd: '/bar'}, async config => {
    expect(await linkAt(config, 'node_modules', '.bin', 'standard')).toEqual('../standard/bin/cmd.js');
  });
});

test('empty bin string does not create a link', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-empty-bin', async config => {
    const binScripts = await fs.walk(path.join(config.cwd, 'node_modules', '.bin'));
    const linkCount = process.platform === 'win32' ? 2 : 1;
    expect(binScripts).toHaveLength(linkCount);

    expect(await linkAt(config, 'node_modules', '.bin', 'depB')).toEqual('../depB/depb.js');
  });
});

describe('with nohoist', () => {
  // address https://github.com/yarnpkg/yarn/issues/5487
  test('nohoist bin should be linked to its own local module', (): Promise<void> => {
    return runInstall({binLinks: true}, 'install-bin-links-nohoist', async config => {
      // make sure all links are created at the right locations and executed correctly
      const stdout1 = await execCommand(config.cwd, ['node_modules', '.bin', 'exec-a'], []);
      const stdout2 = await execCommand(config.cwd, ['node_modules', '.bin', 'exec-f'], []);
      const stdout3 = await execCommand(config.cwd, ['packages', 'a-dep', 'node_modules', '.bin', 'found-me'], []);
      const stdout4 = await execCommand(config.cwd, ['packages', 'f-dep', 'node_modules', '.bin', 'found-me'], []);
      expect(stdout1[0]).toEqual('exec-a');
      expect(stdout2[0]).toEqual('exec-f');
      expect(stdout3[0]).toEqual('found-me');
      expect(stdout4[0]).toEqual('found-me');

      // make sure the shared links: found-me are pointing to the local module
      const localLink = '../found-me/bin.js';
      expect(await linkAt(config, 'packages', 'a-dep', 'node_modules', '.bin', 'found-me')).toEqual(localLink);
      expect(await linkAt(config, 'packages', 'f-dep', 'node_modules', '.bin', 'found-me')).toEqual(localLink);
    });
  });
  test('nohoist bin should not be linked at top level, unless it is a top-level package', (): Promise<void> => {
    return runInstall({binLinks: true}, 'install-bin-links-nohoist', async config => {
      expect(await fs.exists(path.join(config.cwd, 'node_modules', '.bin', 'exec-a'))).toEqual(true);
      expect(await fs.exists(path.join(config.cwd, 'node_modules', '.bin', 'exec-f'))).toEqual(true);
      expect(await fs.exists(path.join(config.cwd, 'node_modules', '.bin', 'found-me'))).toEqual(false);

      // the top-level packages should never be marked nohoist, even if they match nohoist patterns.
      // therefore, expect those still linked at the root node_modules.
      expect(await fs.exists(path.join(config.cwd, 'node_modules', '.bin', 'top-module'))).toEqual(true);
      expect(await linkAt(config, 'node_modules', '.bin', 'top-module')).toEqual('../top-module/bin.js');
    });
  });
});

describe('with focus', () => {
  test('focus points bin links to the shallowly installed packages', (): Promise<void> => {
    return runInstall(
      {binLinks: true, focus: true},
      {source: 'published-monorepo', cwd: '/packages/example-yarn-workspace-1'},
      async (config): Promise<void> => {
        expect(await fs.exists(path.join(config.cwd, 'node_modules', '.bin', 'example-yarn-workspace-2'))).toEqual(
          true,
        );
        expect(await linkAt(config, 'node_modules', '.bin', 'example-yarn-workspace-2')).toEqual(
          '../example-yarn-workspace-2/index.js',
        );
      },
    );
  });
});
