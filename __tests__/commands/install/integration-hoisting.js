/* @flow */

import {getPackageVersion, isPackagePresent, runInstall} from '../_helpers.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

test.concurrent('install hoister should prioritise popular transitive dependencies', (): Promise<void> => {
  // a -> b -> b-2
  //        -> c
  //           -> b-2
  return runInstall({}, 'install-should-prioritise-popular-transitive', async config => {
    expect(await getPackageVersion(config, 'b')).toEqual('2.0.0');
    expect(await getPackageVersion(config, 'a/b')).toEqual('0.0.0');
  });
});

test.concurrent('install hoister should prioritise popular deep dependencies', (): Promise<void> => {
  // Arrange (fixture):
  //   /foo
  //     /baz-1
  //       /hello
  //         /foobar-1
  //       /world
  //   /bar
  //     /baz-1
  //       /hello
  //         /foobar-1
  //       /world
  //   /alice
  //     /bob
  //       /foobar-2
  //     /baz-2
  //       /hello
  //         /foobar-1
  //       /world
  // Act: install
  // Assert: package version picked are foobar-2 and baz-1
  return runInstall({}, 'install-should-prioritise-popular-deep', async config => {
    expect(await getPackageVersion(config, 'bob/foobar')).toEqual('2.0.0');
    expect(await getPackageVersion(config, 'foobar')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'baz')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'alice/baz')).toEqual('2.0.0');
  });
});

test.concurrent(
  'install hoister should not install prioritised popular transitive devDependencies in --prod mode',
  (): Promise<void> => {
    return runInstall({production: true}, 'install-prod-prioritized-popular-transitive-dev-dep', async config => {
      expect(await isPackagePresent(config, 'a')).toEqual(false);
      expect(await isPackagePresent(config, 'b')).toEqual(false);
    });
  },
);
