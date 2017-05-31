/* @flow */

import * as fs from '../../../src/util/fs.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

const request = require('request');
const path = require('path');
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

beforeEach(request.__resetAuthedRequests);
afterEach(request.__resetAuthedRequests);

test('install should hoist nested bin scripts', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-nested-bin', async config => {
    const binScripts = await fs.walk(path.join(config.cwd, 'node_modules', '.bin'));
    // need to double the amount as windows makes 2 entries for each dependency
    // so for below, there would be an entry for eslint and eslint.cmd on win32
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
  });
});

test('install should respect --no-bin-links flag', (): Promise<void> => {
  return runInstall({binLinks: false}, 'install-nested-bin', async config => {
    const binExists = await fs.exists(path.join(config.cwd, 'node_modules', '.bin'));
    expect(binExists).toBeFalsy();
  });
});

// Scenario: Transitive dependency having version that is overridden by newer version as the direct dependency.
// Behavior: eslint@3.12.2 is symlinked in node_modeules/.bin
//           and eslint@3.10.1 is symlinked to node_modules/sample-dep-eslint-3.10.1/node_modules/.bin
test('newer transitive dep is overridden by newer direct dep', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-bin-links-newer', async config => {
    expect(await linkAt(config, 'node_modules', '.bin', 'eslint')).toEqual('../eslint/bin/eslint.js');
    expect(await linkAt(config, 'node_modules', 'sample-dep-eslint-3.10.1', 'node_modules', '.bin', 'eslint')).toEqual(
      '../eslint/bin/eslint.js',
    );
  });
});

// Scenario: Transitive dependency having version that is overridden by older version as the direct dependency.
// Behavior: eslint@3.10.1 is symlinked in node_modeules/.bin
//           and eslint@3.12.2 is symlinked to node_modules/sample-dep-eslint-3.12.2/node_modules/.bin
test('newer transitive dep is overridden by older direct dep', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-bin-links-older', async config => {
    expect(await linkAt(config, 'node_modules', '.bin', 'eslint')).toEqual('../eslint/bin/eslint.js');
    expect(await linkAt(config, 'node_modules', 'sample-dep-eslint-3.12.2', 'node_modules', '.bin', 'eslint')).toEqual(
      '../eslint/bin/eslint.js',
    );
  });
});

// Scenario: Transitive dependency having version that is conflicting with another transitive dependency version.
// Behavior: eslint@3.10.1 is symlinked in node_modeules/.bin
//           and eslint@3.12.2 is symlinked to node_modules/sample-dep-eslint-3.12.2/node_modules/.bin.
//           Here it seems like NPM add the modules in alphabatical order
//           and transitive deps of first dependency is installed at top level.
test('first transient dep is installed when same level and reference count', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-bin-links-conflicting', async config => {
    expect(await linkAt(config, 'node_modules', '.bin', 'eslint')).toEqual('../eslint/bin/eslint.js');
    expect(await linkAt(config, 'node_modules', 'sample-dep-eslint-3.12.2', 'node_modules', '.bin', 'eslint')).toEqual(
      '../eslint/bin/eslint.js',
    );
  });
});

// Scenario: Transitive dependency having version that is conflicting with another dev transitive dependency version.
// Behavior: eslint@3.10.1 is symlinked in node_modeules/.bin
//           and eslint@3.12.2 is symlinked to node_modules/sample-dep-eslint-3.12.2/node_modules/.bin.
//           Whether the dependencies are devDependencies or not does not seem to matter to NPM.
test('first dep is installed when same level and reference count and one is a dev dep', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-bin-links-conflicting-dev', async config => {
    expect(await linkAt(config, 'node_modules', '.bin', 'eslint')).toEqual('../eslint/bin/eslint.js');
    expect(await linkAt(config, 'node_modules', 'sample-dep-eslint-3.12.2', 'node_modules', '.bin', 'eslint')).toEqual(
      '../eslint/bin/eslint.js',
    );
  });
});

// fixes https://github.com/yarnpkg/yarn/issues/3535
// quite a heavy test, did not find a way to isolate
test('Only top level (after hoisting) bin links should be linked', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-bin-links-eslint', async config => {
    expect(await linkAt(config, 'node_modules', '.bin', 'eslint')).toEqual('../eslint/bin/eslint.js');
  });
});
