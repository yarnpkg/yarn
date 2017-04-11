/* @flow */

import {getPackageVersion, runInstall} from '../_helpers.js';
import * as fs from '../../../src/util/fs.js';

const path = require('path');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

test.concurrent('install should dedupe dependencies avoiding conflicts 0', (): Promise<void> => {
  // A@2.0.1 -> B@2.0.0
  // B@1.0.0
  // should result in B@2.0.0 not flattened
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-0', async (config) => {
    expect(await getPackageVersion(config, 'dep-b')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-a/dep-b')).toEqual('2.0.0');
  });
});


test.concurrent('install should dedupe dependencies avoiding conflicts 1', (): Promise<void> => {
  // A@2.0.1 -> B@2.0.0
  // should result in B@2.0.0 flattened
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-1', async (config) => {
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

  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-2', async (config) => {
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
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-3', async (config) => {
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
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-4', async (config) => {
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

  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-5', async (config) => {
    expect(await getPackageVersion(config, 'dep-a')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-b')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-c')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-d')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'dep-d/dep-a')).toEqual('2.0.0');
    expect(await getPackageVersion(config, 'dep-d/dep-b')).toEqual('2.0.0');
  });
});

test.concurrent(
  'install should dedupe dependencies avoiding conflicts 6 (jest/jest-runtime case)',
  (): Promise<void> => {
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
  },
);

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

  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-7', async (config) => {
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
    return runInstall({}, 'install-should-dedupe-avoiding-conflicts-8', async (config) => {
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
  return runInstall({}, 'install-should-dedupe-avoiding-conflicts-9', async (config) => {
    expect(await getPackageVersion(config, 'glob')).toEqual('5.0.15');
    expect(await getPackageVersion(config, 'findup-sync/glob')).toEqual('4.3.5');
    expect(await getPackageVersion(config, 'inquirer')).toEqual('0.8.5');
    expect(await getPackageVersion(config, 'lodash')).toEqual('3.10.1');
    expect(await getPackageVersion(config, 'ast-query/lodash')).toEqual('4.15.0');
    expect(await getPackageVersion(config, 'run-async')).toEqual('0.1.0');
  });
});

test.concurrent('install should hardlink repeated dependencies', (): Promise<void> => {
  // A@1
  // B@1 -> A@2
  // C@1 -> A@2 (this is hardlink to B@1->A@2)
  return runInstall({linkDuplicates: true}, 'hardlink-repeated-dependencies', async (config) => {
    const b_a = await fs.stat(path.join(
      config.cwd,
      'node_modules/b/node_modules/a/package.json',
    ));
    const c_a = await fs.stat(path.join(
      config.cwd,
      'node_modules/c/node_modules/a/package.json',
    ));
    expect(b_a.ino).toEqual(c_a.ino);
  });
});

test.concurrent('install should not hardlink repeated dependencies if linkDuplicates=false', (): Promise<void> => {
  // A@1
  // B@1 -> A@2
  // C@1 -> A@2
  return runInstall({linkDuplicates: false}, 'hardlink-repeated-dependencies', async (config) => {
    const b_a = await fs.stat(path.join(
      config.cwd,
      'node_modules/b/node_modules/a/package.json',
    ));
    const c_a = await fs.stat(path.join(
      config.cwd,
      'node_modules/c/node_modules/a/package.json',
    ));
    expect(b_a.ino).not.toEqual(c_a.ino);
  });
});
