/* @flow */

import PackageHoister, {HoistManifest} from '../src/package-hoister.js';
import PackageResolver from '../src/package-resolver.js';
import Lockfile from '../src/lockfile/wrapper.js';
import type PackageReference from '../src/package-reference.js';
import type Config from '../src/config.js';
import type {Manifest} from '../src/types.js';

const path = require('path');

const CWD = 'tmp';

function createManifestForUid(uid, dependencies): Manifest {
  const name = uid.split('@')[0];
  return (({
    name,
    _reference: (({
      name,
      uid,
      dependencies,
    }: any): PackageReference),
  }: any): Manifest);
}

// Rig up a PackageHoister to use for testing.
// `testModules` is a hash where:
//   key is the module uid, in the form name@version ('lodash@1.2.3')
//   value is an array of strings of dependencies (['lodash@1.2.3', 'grunt@4.5.6'])
// These modules will be loaded into a mock PackageResolver that will use the hash's keys to resolve the package.
function createTestFixture(testModules: any = {}): any {
  const config = (({
    cwd: CWD,
    lockfileFolder: CWD,
    getFolder(): string {
      return 'node_modules';
    },
    generateHardModulePath(pkg: ?PackageReference): string {
      return pkg ? pkg.uid : '';
    },
  }: any): Config);

  // build Manifests with just enough information to get the PackageHoister to work.
  const lockfile = new Lockfile();
  const packageResolver = new PackageResolver(config, lockfile);
  Object.keys(testModules).map(uid => {
    const packageManifest = createManifestForUid(uid, testModules[uid]);

    // load the manifest into the PackageResolver
    packageResolver.addPattern(uid, packageManifest);
  });

  const packageHoister = new PackageHoister(config, packageResolver);

  const atPath = function(...installPaths): string {
    const rootPath = config.modulesFolder || path.join(config.cwd, 'node_modules');
    return path.join(rootPath, ...installPaths);
  };

  const ignorePackage = function(uid) {
    packageResolver.getStrictResolvedPattern(uid)._reference.ignore = true;
  };

  return {
    config,
    packageResolver,
    packageHoister,
    atPath,
    ignorePackage,
  };
}

const toContainPackage = function(received: any, ...expected: any): JestMatcherResult {
  const [uid, expectedInstallPath] = expected;
  let pass: boolean = false;
  received.forEach(pkg => {
    const [location: string, hoistManifest: HoistManifest] = pkg;
    if (location === expectedInstallPath && hoistManifest.pkg._reference.uid === uid) {
      pass = true;
    }
  });

  if (pass) {
    return {
      pass: true,
      message: () => `expected ${received} to not contain package UID ${uid} at path ${expectedInstallPath}`,
    };
  } else {
    return {
      pass: false,
      message: () => `expected ${received} to contain package UID ${uid} at path ${expectedInstallPath}`,
    };
  }
};

expect.extend({toContainPackage});

test('Produces valid destination paths for scoped modules', () => {
  const expected = path.join(CWD, 'node_modules', '@scoped', 'dep');
  const scopedPackageName = '@scoped/dep';

  const key = scopedPackageName;
  const parts = [scopedPackageName];

  const pkg = (({
    _reference: (({}: any): PackageReference),
  }: any): Manifest);

  const info = new HoistManifest(key, parts, pkg, '', true, false);

  const tree = new Map([['@scoped/dep', info]]);

  const fixture = createTestFixture();
  fixture.packageHoister.tree = tree;

  const result = fixture.packageHoister.init();
  const [actual] = result[0];

  expect(actual).toEqual(expected);
});

test('hoists dependencies of dependencies up to root level when no version conflicts exist', () => {
  const {atPath, packageHoister} = createTestFixture({
    'a@1.0.0': ['b@1.0.0'],
    'b@1.0.0': [],
  });

  packageHoister.seed(['a@1.0.0']);
  const result = packageHoister.init();

  expect(result.length).toEqual(2);
  expect(result).toContainPackage('a@1.0.0', atPath('a'));
  expect(result).toContainPackage('b@1.0.0', atPath('b'));
});

test('leaves dependencies of dependencies at leaf level when version conflict exists', () => {
  const {atPath, packageHoister} = createTestFixture({
    'a@1.0.0': ['b@2.0.0'],
    'b@1.0.0': [],
    'b@2.0.0': [],
  });

  packageHoister.seed(['a@1.0.0', 'b@1.0.0']);
  const result = packageHoister.init();

  expect(result.length).toEqual(3);
  expect(result).toContainPackage('a@1.0.0', atPath('a'));
  expect(result).toContainPackage('b@2.0.0', atPath('a', 'node_modules', 'b'));
  expect(result).toContainPackage('b@1.0.0', atPath('b'));
});

test('eliminates duplicates when multiple packages depend on the same package', () => {
  // a@1 -> b@1 -> d@1
  //     -> c@1 -> d@1
  // should become
  // a@1
  // b@1
  // c@1
  // d@1
  const {atPath, packageHoister} = createTestFixture({
    'a@1.0.0': ['b@1.0.0', 'c@1.0.0'],
    'b@1.0.0': ['d@1.0.0'],
    'c@1.0.0': ['d@1.0.0'],
    'd@1.0.0': [],
  });

  packageHoister.seed(['a@1.0.0']);
  const result = packageHoister.init();

  expect(result.length).toEqual(4);
  expect(result).toContainPackage('a@1.0.0', atPath('a'));
  expect(result).toContainPackage('b@1.0.0', atPath('b'));
  expect(result).toContainPackage('c@1.0.0', atPath('c'));
  expect(result).toContainPackage('d@1.0.0', atPath('d'));
});

test('eliminates duplicates when version conflicts exist', () => {
  // a@1 -> b@1 -> c@1 -> d@2
  //            -> e@1 -> d@2
  //     -> d@1
  // should become
  // a@1
  // b@1
  // c@1 -> d@2
  // d@1
  // e@1 -> d@2
  const {atPath, packageHoister} = createTestFixture({
    'a@1.0.0': ['b@1.0.0', 'd@1.0.0'],
    'b@1.0.0': ['c@1.0.0', 'e@1.0.0'],
    'c@1.0.0': ['d@2.0.0'],
    'e@1.0.0': ['d@2.0.0'],
    'd@1.0.0': [],
    'd@2.0.0': [],
  });

  packageHoister.seed(['a@1.0.0']);
  const result = packageHoister.init();

  expect(result.length).toEqual(7);
  expect(result).toContainPackage('a@1.0.0', atPath('a'));
  expect(result).toContainPackage('b@1.0.0', atPath('b'));
  expect(result).toContainPackage('c@1.0.0', atPath('c'));
  expect(result).toContainPackage('d@1.0.0', atPath('d'));
  expect(result).toContainPackage('e@1.0.0', atPath('e'));
  expect(result).toContainPackage('d@2.0.0', atPath('c', 'node_modules', 'd'));
  expect(result).toContainPackage('d@2.0.0', atPath('e', 'node_modules', 'd'));
});

test('uses the modulesFolder configuration option as the first part of the path', () => {
  const {atPath, config, packageHoister} = createTestFixture({
    'a@1.0.0': ['b@2.0.0'],
    'b@1.0.0': [],
    'b@2.0.0': [],
  });
  config.modulesFolder = path.join('modules', 'folder');

  packageHoister.seed(['a@1.0.0', 'b@1.0.0']);
  const result = packageHoister.init();

  expect(result.length).toEqual(3);
  expect(result).toContainPackage('a@1.0.0', atPath('a'));
  expect(result).toContainPackage('b@1.0.0', atPath('b'));
  expect(result).toContainPackage('b@2.0.0', atPath('a', 'node_modules', 'b'));
});

test('does not include ignored packages or their dependencies', () => {
  const {atPath, ignorePackage, packageHoister} = createTestFixture({
    'a@1.0.0': ['c@1.0.0'],
    'b@1.0.0': [],
    'c@1.0.0': [],
  });
  ignorePackage('a@1.0.0');

  packageHoister.seed(['a@1.0.0', 'b@1.0.0']);
  const result = packageHoister.init();

  expect(result.length).toEqual(1);
  expect(result).toContainPackage('b@1.0.0', atPath('b'));
});

test('includes ignored packages dependencies if another non-ignored package depends on it', () => {
  const {atPath, ignorePackage, packageHoister} = createTestFixture({
    'a@1.0.0': ['c@1.0.0'],
    'b@1.0.0': ['c@1.0.0'],
    'c@1.0.0': [],
  });
  ignorePackage('a@1.0.0');

  packageHoister.seed(['a@1.0.0', 'b@1.0.0']);
  const result = packageHoister.init();

  expect(result.length).toEqual(2);
  expect(result).toContainPackage('b@1.0.0', atPath('b'));
  expect(result).toContainPackage('c@1.0.0', atPath('c'));
});

test('considers ignored packages when determining hoisting', () => {
  // a@1 -> d@1 -> c@2
  // b@3(ignored) -> c@5
  // should become
  // a@1
  // d@1 -> c@2
  //
  // Normally c@2 would hoist to the root, but it cannot because c@5 would be there if it was not ignored.
  // This preserves deterministic install paths wheter packages are ignored or not.
  const {atPath, ignorePackage, packageHoister} = createTestFixture({
    'a@1.0.0': ['d@1.0.0'],
    'b@3.0.0': ['c@5.0.0'],
    'd@1.0.0': ['c@2.0.0'],
    'c@2.0.0': [],
    'c@5.0.0': [],
  });
  ignorePackage('b@3.0.0');

  packageHoister.seed(['a@1.0.0', 'b@3.0.0']);
  const result = packageHoister.init();

  expect(result.length).toEqual(3);
  expect(result).toContainPackage('a@1.0.0', atPath('a'));
  expect(result).toContainPackage('d@1.0.0', atPath('d'));
  expect(result).toContainPackage('c@2.0.0', atPath('d', 'node_modules', 'c'));
});

test('will hoist packages under subdirectories when they cannot hoist to root', () => {
  // a@1 -> b@1 -> c@1 -> d@1
  // b@2(ignored) -> c@2 -> d@2
  // should become
  // a@1 -> b@1
  //     -> c@1
  //     -> d@1
  //
  // b,c,d@1 cannot hoist to the root because their @2 versions would be there if not ignored.
  // However they can still flaten under a@1.
  const {atPath, ignorePackage, packageHoister} = createTestFixture({
    'a@1.0.0': ['b@1.0.0'],
    'b@1.0.0': ['c@1.0.0'],
    'c@1.0.0': ['d@1.0.0'],
    'b@2.0.0': ['c@2.0.0'],
    'c@2.0.0': ['d@2.0.0'],
    'd@1.0.0': [],
    'd@2.0.0': [],
  });
  ignorePackage('b@2.0.0');

  packageHoister.seed(['a@1.0.0', 'b@2.0.0']);
  const result = packageHoister.init();

  expect(result.length).toEqual(4);
  expect(result).toContainPackage('a@1.0.0', atPath('a'));
  expect(result).toContainPackage('b@1.0.0', atPath('a', 'node_modules', 'b'));
  expect(result).toContainPackage('c@1.0.0', atPath('a', 'node_modules', 'c'));
  expect(result).toContainPackage('d@1.0.0', atPath('a', 'node_modules', 'd'));
});
