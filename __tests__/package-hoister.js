/* @flow */

import PackageHoister, {HoistManifest} from '../src/package-hoister.js';
import PackageResolver from '../src/package-resolver.js';
import Lockfile from '../src/lockfile';
import type PackageReference from '../src/package-reference.js';
import {extractWorkspaces} from '../src/config.js';
import type Config from '../src/config.js';
import type {Manifest, WorkspacesManifestMap, WorkspacesConfig} from '../src/types.js';
import WorkspaceLayout from '../src/workspace-layout.js';
import {getPackagePath} from './commands/_helpers.js';
import mm from 'micromatch';

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
type UpdateResolver = (resolver: PackageResolver, config: Config) => void;

function createTestFixture(
  testModules: any = {},
  workspacesEnabled: boolean = true,
  updateResolver?: UpdateResolver,
): any {
  const config: Config = (({
    cwd: CWD,
    lockfileFolder: CWD,
    workspacesEnabled,
    getFolder(): string {
      return 'node_modules';
    },
    generateModuleCachePath(pkg: ?PackageReference): string {
      return pkg ? pkg.uid : '';
    },
    getWorkspaces(manifest: ?Manifest): ?WorkspacesConfig {
      if (this.workspacesEnabled) {
        return extractWorkspaces(manifest);
      }
      return undefined;
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

  if (updateResolver) {
    updateResolver(packageResolver, config);
  }

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

  const info = new HoistManifest(key, parts, pkg, '', true, true, false);

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
  // This preserves deterministic install paths whether packages are ignored or not.
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
  // However they can still flatten under a@1.
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

describe('nohoist', () => {
  test('nohoist can be turned off by disable workspaces (workspaces-experimental)', () => {
    const {atPath, packageHoister, packageResolver} = createTestFixture(
      {
        'a@1.0.0': ['c@1.0.0'],
        'b@2.0.0': [],
        'c@1.0.0': [],
      },
      false,
    );
    const pkg: any = packageResolver.getStrictResolvedPattern('a@1.0.0');
    pkg.workspaces = {nohoist: ['c']};

    packageHoister.seed(['a@1.0.0', 'b@2.0.0']);
    const result = packageHoister.init();

    expect(result.length).toEqual(3);
    expect(result).toContainPackage('a@1.0.0', atPath('a'));
    expect(result).toContainPackage('b@2.0.0', atPath('b'));
    expect(result).toContainPackage('c@1.0.0', atPath('c'));
  });
  describe('nohoist = hoist to the top of its branch instead of root', () => {
    function fixture(): any {
      return createTestFixture({
        'a@1.0.0': ['c@1.0.0'],
        'b@1.0.0': ['c@1.0.0'],
        'c@1.0.0': ['d@1.0.0'],
        'd@1.0.0': [],
      });
    }
    test('shallow nohoist', () => {
      const {atPath, packageHoister, packageResolver} = fixture();

      // nohoist a/c
      const pkg: any = packageResolver.getStrictResolvedPattern('a@1.0.0');
      pkg.workspaces = {nohoist: ['c']};

      packageHoister.seed(['a@1.0.0', 'b@1.0.0']);
      const result = packageHoister.init();

      expect(result.length).toEqual(5);
      expect(result).toContainPackage('a@1.0.0', atPath('a'));
      expect(result).toContainPackage('b@1.0.0', atPath('b'));
      expect(result).toContainPackage('c@1.0.0', atPath('c'));
      expect(result).toContainPackage('d@1.0.0', atPath('d'));
      expect(result).toContainPackage('c@1.0.0', atPath('a', 'node_modules', 'c'));
    });
    test('deep nohoist', () => {
      const {atPath, packageHoister, packageResolver} = fixture();

      // nohoist a/c and everything under a/c
      const pkg: any = packageResolver.getStrictResolvedPattern('a@1.0.0');
      pkg.workspaces = {nohoist: ['c', 'c/**']};

      packageHoister.seed(['a@1.0.0', 'b@1.0.0']);
      const result = packageHoister.init();

      expect(result.length).toEqual(6);
      expect(result).toContainPackage('a@1.0.0', atPath('a'));
      expect(result).toContainPackage('b@1.0.0', atPath('b'));
      expect(result).toContainPackage('c@1.0.0', atPath('c'));
      expect(result).toContainPackage('d@1.0.0', atPath('d'));
      expect(result).toContainPackage('c@1.0.0', atPath('a', 'node_modules', 'c'));
      expect(result).toContainPackage('d@1.0.0', atPath('a', 'node_modules', 'd'));
    });
  });
  test('nohoist pkg will be duplicated independent of the hoisted version', () => {
    const {atPath, packageHoister, packageResolver} = createTestFixture({
      'a@1.0.0': ['c@1.0.0'],
      'b@1.0.0': ['c@1.0.0'],
      'c@1.0.0': ['d@1.0.0'],
      'd@1.0.0': [],
    });

    const pkg: any = packageResolver.getStrictResolvedPattern('a@1.0.0');
    pkg.workspaces = {nohoist: ['c']};

    packageHoister.seed(['a@1.0.0', 'b@1.0.0']);
    const result = packageHoister.init();

    expect(result.length).toEqual(5);
    expect(result).toContainPackage('a@1.0.0', atPath('a'));
    expect(result).toContainPackage('b@1.0.0', atPath('b'));
    expect(result).toContainPackage('c@1.0.0', atPath('a', 'node_modules', 'c'));
    expect(result).toContainPackage('c@1.0.0', atPath('c'));
    expect(result).toContainPackage('d@1.0.0', atPath('d'));
  });
  test('nohoist pkg will NOT be duplicated within the same branch', () => {
    const {atPath, packageHoister, packageResolver} = createTestFixture({
      'a@1.0.0': ['b@1.0.0', 'c@1.0.0'],
      'b@1.0.0': ['d@1.0.0'],
      'c@1.0.0': ['d@1.0.0'],
      'd@1.0.0': [],
    });

    const pkg: any = packageResolver.getStrictResolvedPattern('a@1.0.0');
    pkg.workspaces = {nohoist: ['b', 'c', '**/d']};

    packageHoister.seed(['a@1.0.0']);
    const result = packageHoister.init();

    expect(result.length).toEqual(4);
    expect(result).toContainPackage('a@1.0.0', atPath('a'));
    expect(result).toContainPackage('b@1.0.0', atPath('a', 'node_modules', 'b'));
    expect(result).toContainPackage('c@1.0.0', atPath('a', 'node_modules', 'c'));
    expect(result).toContainPackage('d@1.0.0', atPath('a', 'node_modules', 'd'));
  });
  test('can dedupe and avoid circular reference', () => {
    const {atPath, packageHoister, packageResolver} = createTestFixture({
      'a@1.0.0': ['c@1.0.0'],
      'b@2.0.0': [],
      'c@1.0.0': ['d@1.0.0'],
      'd@1.0.0': ['c@1.0.0'],
    });

    const pkg: any = packageResolver.getStrictResolvedPattern('a@1.0.0');
    pkg.workspaces = {nohoist: ['c']};

    packageHoister.seed(['a@1.0.0', 'b@2.0.0']);
    const result = packageHoister.init();

    expect(result.length).toEqual(5);
    expect(result).toContainPackage('a@1.0.0', atPath('a'));
    expect(result).toContainPackage('b@2.0.0', atPath('b'));
    expect(result).toContainPackage('c@1.0.0', atPath('a', 'node_modules', 'c'));
    expect(result).toContainPackage('d@1.0.0', atPath('d'));
    expect(result).toContainPackage('c@1.0.0', atPath('c'));
  });
  test('can handle conflict version', () => {
    const {atPath, packageHoister, packageResolver} = createTestFixture({
      'a@1.0.0': ['c@1.0.0'],
      'b@2.0.0': [],
      'b@1.0.0': [],
      'c@1.0.0': ['b@1.0.0'],
    });

    const pkg: any = packageResolver.getStrictResolvedPattern('a@1.0.0');
    pkg.workspaces = {nohoist: ['c']};

    packageHoister.seed(['a@1.0.0', 'b@2.0.0']);
    const result = packageHoister.init();

    expect(result.length).toEqual(4);
    expect(result).toContainPackage('a@1.0.0', atPath('a'));
    expect(result).toContainPackage('b@2.0.0', atPath('b'));
    expect(result).toContainPackage('c@1.0.0', atPath('a', 'node_modules', 'c'));
    expect(result).toContainPackage('b@1.0.0', atPath('a', 'node_modules', 'b'));
  });

  test('nohoist matches package regardless version', () => {
    const {atPath, packageHoister, packageResolver} = createTestFixture({
      'a@1.0.0': ['b@1.0.0', 'c@1.0.0'],
      'b@1.0.0': [],
      'b@2.0.0': [],
      'c@1.0.0': ['b@2.0.0'],
    });

    const pkg: any = packageResolver.getStrictResolvedPattern('a@1.0.0');
    pkg.workspaces = {nohoist: ['b', 'c']};

    packageHoister.seed(['a@1.0.0']);
    const result = packageHoister.init();

    expect(result.length).toEqual(4);
    expect(result).toContainPackage('a@1.0.0', atPath('a'));
    expect(result).toContainPackage('b@1.0.0', atPath('a', 'node_modules', 'b'));
    expect(result).toContainPackage('c@1.0.0', atPath('a', 'node_modules', 'c'));
    expect(result).toContainPackage('b@2.0.0', atPath('a', 'node_modules', 'c', 'node_modules', 'b'));
  });
  test('can detect circular reference', () => {
    const {atPath, packageHoister, packageResolver} = createTestFixture({
      'a@1.0.0': ['b@1.0.0', 'c@1.0.0'],
      'b@2.0.0': [],
      'b@1.0.0': ['c@1.0.0'],
      'c@1.0.0': ['b@2.0.0'],
    });

    const pkg: any = packageResolver.getStrictResolvedPattern('a@1.0.0');
    pkg.workspaces = {nohoist: ['b']};

    packageHoister.seed(['a@1.0.0', 'b@2.0.0']);
    const result = packageHoister.init();

    expect(result.length).toEqual(4);
    expect(result).toContainPackage('a@1.0.0', atPath('a'));
    expect(result).toContainPackage('b@2.0.0', atPath('b'));
    expect(result).toContainPackage('b@1.0.0', atPath('a', 'node_modules', 'b'));
    expect(result).toContainPackage('c@1.0.0', atPath('c'));
  });
  test('can nohoist a linked package', () => {
    const {atPath, packageHoister, packageResolver} = createTestFixture({
      'a@1.0.0': ['b@1.0.0', 'c@1.0.0'],
      'b@1.0.0': ['d@1.0.0'],
      'c@1.0.0': [],
      'd@1.0.0': [],
    });

    // b is a linked package
    let pkg: any = packageResolver.getStrictResolvedPattern('b@1.0.0');
    pkg._remote = {type: 'link'};

    // a will not hoist b and everything under b
    pkg = packageResolver.getStrictResolvedPattern('a@1.0.0');
    pkg.workspaces = {nohoist: ['b', 'b/**']};

    packageHoister.seed(['a@1.0.0']);
    const result = packageHoister.init();

    expect(result.length).toEqual(4);
    expect(result).toContainPackage('a@1.0.0', atPath('a'));
    expect(result).toContainPackage('c@1.0.0', atPath('c'));
    expect(result).toContainPackage('d@1.0.0', atPath('a', 'node_modules', 'd'));
    expect(result).toContainPackage('b@1.0.0', atPath('a', 'node_modules', 'b'));
  });

  describe('nohoistList pattern matching', () => {
    const paths = ['a', 'a/b', 'a/b/c', 'a/b/c/d', 'a/d', 'b/c', 'd/a', 'e/d/a', 'd/a/e', 'd/a/e/b'];
    test('match explicit path', () => {
      expect(mm(paths, 'a')).toEqual(['a']);
      expect(mm(paths, 'b/c')).toEqual(['b/c']);
      expect(mm(paths, 'd')).toEqual([]);
      expect(mm(paths, 'a/b')).toEqual(['a/b']);
    });
    test('match glob pattern', () => {
      expect(mm(paths, '**')).toEqual(paths);
      expect(mm(paths, '*')).toEqual(['a']);

      expect(mm(paths, 'a/*')).toEqual(['a/b', 'a/d']);
      expect(mm(paths, 'a/**')).toEqual(['a/b', 'a/b/c', 'a/b/c/d', 'a/d']);
      expect(mm(paths, '*/a')).toEqual(['d/a']);
      expect(mm(paths, '**/a')).toEqual(['a', 'd/a', 'e/d/a']);
      expect(mm(paths, '*/a/*')).toEqual(['d/a/e']);
      expect(mm(paths, '**/a/**')).toEqual(['a/b', 'a/b/c', 'a/b/c/d', 'a/d', 'd/a/e', 'd/a/e/b']);
    });
  });
  test('can disable hoist for the whole branch', () => {
    const {atPath, packageHoister, packageResolver} = createTestFixture({
      'a@1.0.0': ['b@1.0.0', 'c@1.0.0'],
      'b@1.0.0': ['d@1.0.0'],
      'c@1.0.0': ['d@1.0.0'],
      'd@1.0.0': [],
    });

    // disable hoisting for everything under a
    const pkg: any = packageResolver.getStrictResolvedPattern('a@1.0.0');
    pkg.workspaces = {nohoist: ['**']};

    packageHoister.seed(['a@1.0.0', 'b@1.0.0']);
    const result = packageHoister.init();

    expect(result.length).toEqual(6);
    expect(result).toContainPackage('a@1.0.0', atPath('a'));
    expect(result).toContainPackage('b@1.0.0', atPath('b'));
    expect(result).toContainPackage('d@1.0.0', atPath('d'));

    expect(result).toContainPackage('b@1.0.0', atPath('a', 'node_modules', 'b'));
    expect(result).toContainPackage('c@1.0.0', atPath('a', 'node_modules', 'c'));
    expect(result).toContainPackage('d@1.0.0', atPath('a', 'node_modules', 'd'));
  });
  test('can disable hoist for particular package tree', () => {
    const {atPath, packageHoister, packageResolver} = createTestFixture({
      'a@1.0.0': ['b@1.0.0', 'e@1.0.0'],
      'b@1.0.0': ['c@1.0.0'],
      'c@1.0.0': ['d@1.0.0'],
      'd@1.0.0': [],
      'e@1.0.0': [],
    });

    // disable hoisting for everything under a
    const pkg: any = packageResolver.getStrictResolvedPattern('a@1.0.0');
    pkg.workspaces = {nohoist: ['b', 'b/**']};

    packageHoister.seed(['a@1.0.0']);
    const result = packageHoister.init();

    expect(result.length).toEqual(5);
    expect(result).toContainPackage('a@1.0.0', atPath('a'));
    expect(result).toContainPackage('e@1.0.0', atPath('e'));

    expect(result).toContainPackage('b@1.0.0', atPath('a', 'node_modules', 'b'));
    expect(result).toContainPackage('c@1.0.0', atPath('a', 'node_modules', 'c'));
    expect(result).toContainPackage('d@1.0.0', atPath('a', 'node_modules', 'd'));
  });
  describe('nohoist with workspaces context', () => {
    function updateWorkspaces(rootPattern: string, nohoist?: Array<string>, workspaces: Array<string>): UpdateResolver {
      return (resolver: PackageResolver, config: Config): void => {
        const root: Manifest = resolver.getStrictResolvedPattern(rootPattern);
        if (nohoist) {
          root.workspaces = {nohoist};
        }

        const wsMap: WorkspacesManifestMap = {};
        wsMap[root.name] = {loc: root._loc || '', manifest: root};

        workspaces.forEach(w => {
          const pkg = resolver.getStrictResolvedPattern(w);
          pkg._remote = {
            type: 'workspace',
            registry: 'npm',
            hash: null,
            reference: '',
          };
          wsMap[pkg.name] = {loc: pkg._loc || '', manifest: pkg};
        });
        resolver.workspaceLayout = new WorkspaceLayout(wsMap, config);
        resolver.workspaceLayout.virtualManifestName = root.name;

        // hoister.nohoistResolver._wsRootPackageName = root.name;
      };
    }
    describe('disable hoist for a package', () => {
      function fixture(f: UpdateResolver): any {
        return createTestFixture(
          {
            'w1@1.0.0': ['a@1.0.0'],
            'w2@1.0.0': ['a@1.0.0', 'b@1.0.0'],
            'a@1.0.0': ['c@1.0.0'],
            'b@1.0.0': ['a@1.0.0'],
            'c@1.0.0': [],
            'root@1.0.0': ['w1@1.0.0', 'w2@1.0.0'],
          },
          true,
          f,
        );
      }

      test('from root for all workspaces', () => {
        // root disable 'a' hoisting, no matter where it is
        const {packageHoister} = fixture(updateWorkspaces('root@1.0.0', ['**/a'], ['w1@1.0.0', 'w2@1.0.0']));
        const config = packageHoister.config;

        packageHoister.seed(['root@1.0.0']);
        const result = packageHoister.init();

        expect(result.length).toEqual(8);
        expect(result).toContainPackage('root@1.0.0', getPackagePath(config, 'root'));
        expect(result).toContainPackage('w1@1.0.0', getPackagePath(config, 'w1'));
        expect(result).toContainPackage('w2@1.0.0', getPackagePath(config, 'w2'));
        expect(result).toContainPackage('b@1.0.0', getPackagePath(config, 'b'));
        expect(result).toContainPackage('c@1.0.0', getPackagePath(config, 'c'));

        expect(result).toContainPackage('a@1.0.0', getPackagePath(config, 'w1/a'));
        expect(result).toContainPackage('a@1.0.0', getPackagePath(config, 'w2/a'));

        // note: a hoisted b will also inherit the root's nohoist constraint
        expect(result).toContainPackage('a@1.0.0', getPackagePath(config, 'b/a'));
      });
      test('from root for a specific workspaces', () => {
        // root disable 'a' hoisting, no matter where it is
        const {packageHoister} = fixture(updateWorkspaces('root@1.0.0', ['w1/a'], ['w1@1.0.0', 'w2@1.0.0']));
        const config = packageHoister.config;

        packageHoister.seed(['root@1.0.0']);
        const result = packageHoister.init();

        expect(result.length).toEqual(7);
        expect(result).toContainPackage('root@1.0.0', getPackagePath(config, 'root'));
        expect(result).toContainPackage('w1@1.0.0', getPackagePath(config, 'w1'));
        expect(result).toContainPackage('w2@1.0.0', getPackagePath(config, 'w2'));
        expect(result).toContainPackage('a@1.0.0', getPackagePath(config, 'a'));
        expect(result).toContainPackage('b@1.0.0', getPackagePath(config, 'b'));
        expect(result).toContainPackage('c@1.0.0', getPackagePath(config, 'c'));

        expect(result).toContainPackage('a@1.0.0', getPackagePath(config, 'w1/a'));
      });
      test('from workspace', () => {
        // w2 disable 'a' hoisting
        const {packageHoister, packageResolver} = fixture(
          updateWorkspaces('root@1.0.0', undefined, ['w1@1.0.0', 'w2@1.0.0']),
        );
        const config = packageHoister.config;

        const pkg: any = packageResolver.getStrictResolvedPattern('w2@1.0.0');
        pkg.workspaces = {nohoist: ['a']};

        packageHoister.seed(['root@1.0.0']);
        const result = packageHoister.init();

        expect(result.length).toEqual(7);
        expect(result).toContainPackage('root@1.0.0', getPackagePath(config, 'root'));
        expect(result).toContainPackage('w1@1.0.0', getPackagePath(config, 'w1'));
        expect(result).toContainPackage('w2@1.0.0', getPackagePath(config, 'w2'));
        expect(result).toContainPackage('a@1.0.0', getPackagePath(config, 'a'));
        expect(result).toContainPackage('b@1.0.0', getPackagePath(config, 'b'));
        expect(result).toContainPackage('c@1.0.0', getPackagePath(config, 'c'));

        expect(result).toContainPackage('a@1.0.0', getPackagePath(config, 'w2/a'));
      });
    });
    describe('workspace depends on another workspace', () => {
      function fixture(f: UpdateResolver): any {
        return createTestFixture(
          {
            'w1@1.0.0': ['a@1.0.0'],
            'w2@1.0.0': ['w1@1.0.0', 'b@1.0.0'],
            'a@1.0.0': ['c@1.0.0'],
            'b@1.0.0': ['c@1.0.0'],
            'c@1.0.0': [],
            'root@1.0.0': ['w1@1.0.0', 'w2@1.0.0'],
          },
          true,
          f,
        );
      }
      test('can nohoist dependent workspace just like any package', () => {
        const {packageHoister, packageResolver} = fixture(
          updateWorkspaces('root@1.0.0', undefined, ['w1@1.0.0', 'w2@1.0.0']),
        );
        const config = packageHoister.config;

        // w2 disable 'w1' and all of w1's direct dependency hoisting
        const pkg: any = packageResolver.getStrictResolvedPattern('w2@1.0.0');
        pkg.workspaces = {nohoist: ['w1', 'w1/**']};

        packageHoister.seed(['root@1.0.0']);
        const result = packageHoister.init();

        expect(result.length).toEqual(9);
        expect(result).toContainPackage('root@1.0.0', getPackagePath(config, 'root'));
        expect(result).toContainPackage('w1@1.0.0', getPackagePath(config, 'w1'));
        expect(result).toContainPackage('w2@1.0.0', getPackagePath(config, 'w2'));
        expect(result).toContainPackage('a@1.0.0', getPackagePath(config, 'a'));
        expect(result).toContainPackage('b@1.0.0', getPackagePath(config, 'b'));
        expect(result).toContainPackage('c@1.0.0', getPackagePath(config, 'c'));

        expect(result).toContainPackage('w1@1.0.0', getPackagePath(config, 'w2/w1'));
        expect(result).toContainPackage('a@1.0.0', getPackagePath(config, 'w2/a'));
        expect(result).toContainPackage('c@1.0.0', getPackagePath(config, 'w2/c'));
      });
      test('all workspaces nohoist will be honored', () => {
        const {packageHoister, packageResolver} = fixture(
          updateWorkspaces('root@1.0.0', undefined, ['w1@1.0.0', 'w2@1.0.0']),
        );
        const config = packageHoister.config;

        // w2 disable all of its top level packages hoisting
        let pkg: any = packageResolver.getStrictResolvedPattern('w2@1.0.0');
        pkg.workspaces = {nohoist: ['*']};

        // w1 disable 'a' and all of its dependency hoisting
        pkg = packageResolver.getStrictResolvedPattern('w1@1.0.0');
        pkg.workspaces = {nohoist: ['a', 'a/**']};

        packageHoister.seed(['root@1.0.0']);
        const result = packageHoister.init();

        expect(result.length).toEqual(10);
        // root
        expect(result).toContainPackage('root@1.0.0', getPackagePath(config, 'root'));
        expect(result).toContainPackage('w1@1.0.0', getPackagePath(config, 'w1'));
        expect(result).toContainPackage('w2@1.0.0', getPackagePath(config, 'w2'));
        // from w2/b/c
        expect(result).toContainPackage('c@1.0.0', getPackagePath(config, 'c'));

        // under w1
        expect(result).toContainPackage('a@1.0.0', getPackagePath(config, 'w1/a'));
        expect(result).toContainPackage('c@1.0.0', getPackagePath(config, 'w1/c'));

        // under w2
        expect(result).toContainPackage('w1@1.0.0', getPackagePath(config, 'w2/w1'));
        expect(result).toContainPackage('a@1.0.0', getPackagePath(config, 'w2/a'));
        expect(result).toContainPackage('b@1.0.0', getPackagePath(config, 'w2/b'));
        expect(result).toContainPackage('c@1.0.0', getPackagePath(config, 'w2/c'));
      });
    });
  });
  test('originalParentPath shows before-hoist dependency tree path', () => {
    const {packageHoister} = createTestFixture({
      'a@1.0.0': ['c@1.0.0'],
      'b@1.0.0': ['c@1.0.0'],
      'c@1.0.0': [],
    });

    // disable hoisting for everything under a
    packageHoister.seed(['a@1.0.0', 'b@1.0.0']);
    const result = packageHoister.init();
    const paths = result.map(r => [r[1].key, r[1].originalParentPath]);

    expect(paths.length).toEqual(3);
    expect(paths).toContainEqual(['a', '']);
    expect(paths).toContainEqual(['b', '']);
    expect(paths).toContainEqual(['c', '/a']);
  });
  test('previousPaths should reflect hoist history', () => {
    const {packageHoister} = createTestFixture({
      'a@1.0.0': ['c@1.0.0'],
      'b@1.0.0': ['c@1.0.0'],
      'c@1.0.0': [],
    });

    // disable hoisting for everything under a
    packageHoister.seed(['a@1.0.0', 'b@1.0.0']);
    const result = packageHoister.init();
    const hoistHistory = result.map(r => [r[1].key, r[1].previousPaths]);

    expect(hoistHistory.length).toEqual(3);
    expect(hoistHistory).toContainEqual(['a', []]);
    expect(hoistHistory).toContainEqual(['b', []]);
    expect(hoistHistory).toContainEqual(['c', ['/a/c', '/b/c']]);
  });
});
