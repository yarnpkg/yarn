/* @flow */

import {getPackageVersion, getPackageManifestPath, runInstall} from '../_helpers.js';
import * as fs from '../../../src/util/fs.js';

const path = require('path');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

test.concurrent('install should dedupe dependencies avoiding conflicts 0', (): Promise<void> => {
  // A@2.0.1 -> B@2.0.0
  // B@1.0.0
  // should result in B@2.0.0 not flattened
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-0', async config => {
    expect(await getPackageVersion(config, 'dep-b')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-a/dep-b')).toEqual('2.0.0');
  });
});

test.concurrent('install should dedupe dependencies avoiding conflicts 1', (): Promise<void> => {
  // A@2.0.1 -> B@2.0.0
  // should result in B@2.0.0 flattened
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-1', async config => {
    expect(await getPackageVersion(config, 'dep-b')).toEqual('2.0.0');
    expect(await getPackageVersion(config, 'dep-a')).toEqual('2.0.1');
  });
});

test.concurrent('install should dedupe dependencies avoiding conflicts 2', (): Promise<void> => {
  // A@2 -> B@2 -> C@2
  //            -> D@1
  // B@1 -> C@1
  // should become
  // A@2
  // A@2 -> B@2
  // A@2 -> C@2
  // D@1
  // C@1
  // B@1

  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-2', async config => {
    expect(await getPackageVersion(config, 'dep-a')).toEqual('2.0.0');
    expect(await getPackageVersion(config, 'dep-a/dep-b')).toEqual('2.0.0');
    expect(await getPackageVersion(config, 'dep-c')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-d')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-b')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-a/dep-c')).toEqual('2.0.0');
  });
});

test.concurrent('install should dedupe dependencies avoiding conflicts 3', (): Promise<void> => {
  // A@2 -> B@2 -> C@2
  //            -> D@1
  //     -> C@1
  // should become
  // A@2
  // B@2 -> C@2
  // C@1
  // D@1
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-3', async config => {
    expect(await getPackageVersion(config, 'dep-a')).toEqual('2.0.0');
    expect(await getPackageVersion(config, 'dep-c')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-d')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-b')).toEqual('2.0.0');
    expect(await getPackageVersion(config, 'dep-b/dep-c')).toEqual('2.0.0');
  });
});

test.concurrent('install should dedupe dependencies avoiding conflicts 4', (): Promise<void> => {
  // A@2 -> B@2 -> D@1 -> C@2
  //
  //     -> C@1

  // should become
  // A@2
  // D@1 -> C@2
  // C@1
  // B@2
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-4', async config => {
    expect(await getPackageVersion(config, 'dep-a')).toEqual('2.0.0');
    expect(await getPackageVersion(config, 'dep-c')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-d')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-d/dep-c')).toEqual('2.0.0');
    expect(await getPackageVersion(config, 'dep-b')).toEqual('2.0.0');
  });
});

test.concurrent('install should dedupe dependencies avoiding conflicts 5', (): Promise<void> => {
  // A@1 -> B@1
  // C@1 -> D@1 -> A@2 -> B@2

  // should become

  // A@1
  // B@1
  // C@1
  // D@1 -> A@2
  //     -> B@2

  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-5', async config => {
    expect(await getPackageVersion(config, 'dep-a')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-b')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-c')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-d')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-d/dep-a')).toEqual('2.0.0');
    expect(await getPackageVersion(config, 'dep-d/dep-b')).toEqual('2.0.0');
  });
});

test.concurrent('install should dedupe dependencies avoiding conflicts 6 (jest/jest-runtime case)', (): Promise<
  void,
> => {
  // C@1 -> D@1 -> E@1
  // B@1 -> C@1 -> D@1 -> E@1
  // D@2
  // E@2

  // should become

  // C@1 -> D@1
  //     -> E@1
  // B@1
  // D@2
  // E@2

  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-6', async (config): Promise<void> => {
    expect(await getPackageVersion(config, 'dep-b')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-c')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-d')).toEqual('2.0.0');
    expect(await getPackageVersion(config, 'dep-e')).toEqual('2.0.0');

    expect(await getPackageVersion(config, 'dep-c/dep-d')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-c/dep-e')).toEqual('1.0.0');
  });
});

test.concurrent('install should dedupe dependencies avoiding conflicts 7', (): Promise<void> => {
  // A@1 -> C@1 -> D@1 -> E@1
  // B@1 -> C@1 -> D@1 -> E@1
  // C@2
  // D@2
  // E@2

  // should become

  // A@1 -> C@1
  //     -> D@1
  //     -> E@1
  // B@1 -> C@1
  //     -> D@1
  //     -> E@1
  // C@2
  // D@2
  // E@2

  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-7', async config => {
    expect(await getPackageVersion(config, 'dep-a')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-b')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-c')).toEqual('2.0.0');
    expect(await getPackageVersion(config, 'dep-d')).toEqual('2.0.0');
    expect(await getPackageVersion(config, 'dep-e')).toEqual('2.0.0');

    expect(await getPackageVersion(config, 'dep-a/dep-c')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-a/dep-d')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-a/dep-e')).toEqual('1.0.0');

    expect(await getPackageVersion(config, 'dep-b/dep-c')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-b/dep-d')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-b/dep-e')).toEqual('1.0.0');
  });
});

if (!process.env.TRAVIS || process.env.TRAVIS_OS_NAME !== 'osx') {
  // This test is unstable and timeouts on Travis OSX builds https://travis-ci.org/yarnpkg/yarn/jobs/188864079
  test.concurrent('install should dedupe dependencies avoiding conflicts 8', (): Promise<void> => {
    // revealed in https://github.com/yarnpkg/yarn/issues/112
    // adapted for https://github.com/yarnpkg/yarn/issues/1158
    return runInstall({}, 'install-should-dedupe-avoiding-conflicts-8', async config => {
      expect(await getPackageVersion(config, 'glob')).toEqual('5.0.15');
      expect(await getPackageVersion(config, 'findup-sync/glob')).toEqual('4.3.5');
      expect(await getPackageVersion(config, 'inquirer')).toEqual('0.8.5');
      expect(await getPackageVersion(config, 'lodash')).toEqual('3.10.1');
      expect(await getPackageVersion(config, 'ast-query/lodash')).toEqual('4.15.0');
      expect(await getPackageVersion(config, 'run-async')).toEqual('0.1.0');
    });
  });
}

test.concurrent('install should dedupe dependencies avoiding conflicts 9', (): Promise<void> => {
  // revealed in https://github.com/yarnpkg/yarn/issues/112
  // adapted for https://github.com/yarnpkg/yarn/issues/1158
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-9', async config => {
    expect(await getPackageVersion(config, 'glob')).toEqual('5.0.15');
    expect(await getPackageVersion(config, 'findup-sync/glob')).toEqual('4.3.5');
    expect(await getPackageVersion(config, 'inquirer')).toEqual('0.8.5');
    expect(await getPackageVersion(config, 'lodash')).toEqual('3.10.1');
    expect(await getPackageVersion(config, 'ast-query/lodash')).toEqual('4.15.0');
    expect(await getPackageVersion(config, 'run-async')).toEqual('0.1.0');
  });
});

describe('hardlink', () => {
  test.concurrent('install should hardlink repeated dependencies', (): Promise<void> => {
    // A@1
    // B@1 -> A@2
    // C@1 -> A@2 (this is hardlink to B@1->A@2)
    return runInstall({linkDuplicates: true}, 'hardlink-repeated-dependencies', async config => {
      const b_a = await fs.stat(getPackageManifestPath(config, 'b/a'));
      const c_a = await fs.stat(getPackageManifestPath(config, 'c/a'));
      expect(b_a.ino).toEqual(c_a.ino);
    });
  });

  test.concurrent('install should not hardlink repeated dependencies if linkDuplicates=false', (): Promise<void> => {
    // A@1
    // B@1 -> A@2
    // C@1 -> A@2
    return runInstall({linkDuplicates: false}, 'hardlink-repeated-dependencies', async config => {
      const b_a = await fs.stat(getPackageManifestPath(config, 'b/a'));
      const c_a = await fs.stat(getPackageManifestPath(config, 'c/a'));
      expect(b_a.ino).not.toEqual(c_a.ino);
    });
  });

  test.concurrent('install should not crash when hardlinking deep structures', (): Promise<void> => {
    // https://github.com/yarnpkg/yarn/issues/2734
    // A@1 -> B@1 -> C@1
    //     -> C@2
    // B@2
    // C@3
    // D@1 -> B@1 (hardlink) -> C@1 (hardlink)
    //     -> C@2
    return runInstall({linkDuplicates: true}, 'hardlink-collision', async config => {
      let a_1 = await fs.stat(path.join(config.cwd, 'node_modules/a/node_modules/b/package.json'));
      let d_1 = await fs.stat(path.join(config.cwd, 'node_modules/d/node_modules/b/package.json'));
      expect(a_1.ino).toEqual(d_1.ino);
      a_1 = await fs.stat(path.join(config.cwd, 'node_modules/a/node_modules/b/node_modules/c/package.json'));
      d_1 = await fs.stat(path.join(config.cwd, 'node_modules/d/node_modules/b/node_modules/c/package.json'));
      expect(a_1.ino).toEqual(d_1.ino);
    });
  });

  test.concurrent('install should consider different hoisting with --link-duplicate', (): Promise<void> => {
    // https://github.com/yarnpkg/yarn/issues/2734
    // A@1 -> B@1 -> C@1
    //     -> C@2
    // B@2
    // C@3
    // D@1 -> B@1 (hardlink) -> *C@1* (redundant)
    //     -> C@1 (hardlink)
    return runInstall({linkDuplicates: true}, 'hardlink-collision-2', async config => {
      let a_1 = await fs.stat(path.join(config.cwd, 'node_modules/a/node_modules/b/package.json'));
      let d_1 = await fs.stat(path.join(config.cwd, 'node_modules/d/node_modules/b/package.json'));
      expect(a_1.ino).toEqual(d_1.ino);
      a_1 = await fs.stat(path.join(config.cwd, 'node_modules/a/node_modules/b/node_modules/c/package.json'));
      d_1 = await fs.stat(path.join(config.cwd, 'node_modules/d/node_modules/c/package.json'));
      expect(a_1.ino).toEqual(d_1.ino);
      // this is redundant but we are ok with it
      expect(await fs.exists(path.join(config.cwd, 'node_modules/d/node_modules/b/node_modules/c/package.json'))).toBe(
        true,
      );
    });
  });

  test.concurrent('install should consider different hoisting with --link-duplicate 2', (): Promise<void> => {
    // https://github.com/yarnpkg/yarn/issues/2734
    // A@1 -> B@1
    //     -> C@1
    // B@2
    // C@3
    // D@1 -> B@1 (hardlink) -> C@1 (hardlink)
    //     -> C@2
    return runInstall({linkDuplicates: true}, 'hardlink-collision-3', async config => {
      let a_1 = await fs.stat(path.join(config.cwd, 'node_modules/a/node_modules/b/package.json'));
      let d_1 = await fs.stat(path.join(config.cwd, 'node_modules/d/node_modules/b/package.json'));
      expect(a_1.ino).toEqual(d_1.ino);
      a_1 = await fs.stat(path.join(config.cwd, 'node_modules/a/node_modules/c/package.json'));
      d_1 = await fs.stat(path.join(config.cwd, 'node_modules/d/node_modules/b/node_modules/c/package.json'));
      expect(a_1.ino).toEqual(d_1.ino);
    });
  });

  test.concurrent('install should not hardlink full package structure', (): Promise<void> => {
    // https://github.com/yarnpkg/yarn/issues/2734
    // A@1 -> B@1 -> C@1 -> (bundle leftpad)
    //     -> C@2
    // B@2
    // C@3
    // D@1 -> B@1 (hardlink) -> C@1 (hardlink) -> (bundle leftpad) (hardlink)
    //     -> C@2
    return runInstall({linkDuplicates: true}, 'hardlink-collision-with-bundled', async config => {
      let a_1 = await fs.stat(path.join(config.cwd, 'node_modules/a/node_modules/b/package.json'));
      let d_1 = await fs.stat(path.join(config.cwd, 'node_modules/d/node_modules/b/package.json'));
      expect(a_1.ino).toEqual(d_1.ino);
      a_1 = await fs.stat(path.join(config.cwd, 'node_modules/a/node_modules/b/node_modules/c/package.json'));
      d_1 = await fs.stat(path.join(config.cwd, 'node_modules/d/node_modules/b/node_modules/c/package.json'));
      expect(a_1.ino).toEqual(d_1.ino);
      a_1 = await fs.stat(
        path.join(config.cwd, 'node_modules/a/node_modules/b/node_modules/c/node_modules/left-pad/package.json'),
      );
      d_1 = await fs.stat(
        path.join(config.cwd, 'node_modules/d/node_modules/b/node_modules/c/node_modules/left-pad/package.json'),
      );
      expect(a_1.ino).toEqual(d_1.ino);
    });
  });

  describe('in workspaces', () => {
    // https://github.com/yarnpkg/yarn/issues/5421
    // test hardlink can work within workspaces containing 1) scoped 2) linked dependency
    // 3) internal workspace reference
    // M -> w1, w2
    //  w1 -> a-1, c-1(link), w2
    //  w2 -> b-1, c-1(link)
    //    a-1
    //    b-1 -> a-1
    //    c-1
    test.concurrent('no hardlink for workspace references and linked dependencies', (): Promise<void> => {
      // when no conflict, everything should be hoisted to the top without exception
      return runInstall(
        {linkDuplicates: true, workspacesNohoistEnabled: false},
        'hardlink-scoped-workspaces',
        async config => {
          await Promise.all(
            //verify the expected modules created under root node_modules
            [['a'], ['b'], ['c'], ['@sub', 'w1'], ['@sub', 'w2']].map(async m => {
              const p = path.join(config.cwd, 'node_modules', ...m, 'package.json');
              const existed = await fs.exists(p);
              expect(existed).toEqual(true);
            }),
          );
          //verify the c, w1 and w2 are created as symlink
          await Promise.all(
            [['c'], ['@sub', 'w1'], ['@sub', 'w2']].map(async m => {
              const p = path.join(config.cwd, 'node_modules', ...m);
              const f = await fs.lstat(p);
              expect(f.isSymbolicLink()).toEqual(true);

              //we can follow the link to find the package.json
              const existed = await fs.exists(path.join(p, 'package.json'));
              expect(existed).toEqual(true);
            }),
          );

          //verify there is nothing under any workspaces' node_modules
          await Promise.all(
            [['packages', 'w1'], ['packages', 'w2']].map(async m => {
              const existed = await fs.exists(path.join(config.cwd, ...m, 'node_modules'));
              expect(existed).toEqual(false);
            }),
          );
        },
      );
    });
    test.concurrent('should work with nohoist', (): Promise<void> => {
      // https://github.com/yarnpkg/yarn/issues/5421
      // nohoist everything should put all dependencies under each workspaces's
      // local node_modules and hardlink accordingly
      return runInstall(
        {linkDuplicates: true, workspacesNohoistEnabled: true},
        'hardlink-scoped-workspaces',
        async config => {
          //verify the expected modules created under root node_modules
          await Promise.all(
            [['@sub', 'w1'], ['@sub', 'w2']].map(async m => {
              const p = path.join(config.cwd, 'node_modules', ...m);
              const f = await fs.lstat(p);
              expect(f.isSymbolicLink()).toEqual(true);
            }),
          );

          //verify w1 and w2 node_modules hardlinked modules: a
          const a1 = await fs.stat(path.join(config.cwd, 'packages', 'w1', 'node_modules', 'a', 'package.json'));
          const a2 = await fs.stat(path.join(config.cwd, 'packages', 'w2', 'node_modules', 'a', 'package.json'));
          expect(a1.ino).toEqual(a2.ino);

          //verify b is created under w2 but without anything under its modules
          let existed = await fs.exists(path.join(config.cwd, 'packages', 'w2', 'node_modules', 'b', 'package.json'));
          expect(existed).toEqual(true);
          existed = await fs.exists(path.join(config.cwd, 'packages', 'w2', 'node_modules', 'b', 'node_modules'));
          expect(existed).toEqual(false);

          //verify the c, w1 are created as symlink under the workspaces
          await Promise.all(
            [
              ['packages', 'w1', 'node_modules', 'c'],
              ['packages', 'w2', 'node_modules', 'c'],
              ['packages', 'w1', 'node_modules', '@sub', 'w2'],
            ].map(async m => {
              const p = path.join(config.cwd, ...m);
              const f = await fs.lstat(p);
              expect(f.isSymbolicLink()).toEqual(true);

              //we can follow the link to find the package.json
              const existed = await fs.exists(path.join(p, 'package.json'));
              expect(existed).toEqual(true);
            }),
          );
        },
      );
    });
  });
});
