/* @flow */

import PackageRequest from '../../../src/package-request.js';
import RegistryResolver from '../../../src/resolvers/exotics/registry-resolver.js';

const mockPackageRequest: PackageRequest = ({}: any);

test('resolves unscoped npm: package', () => {
  const resolver = new RegistryResolver(mockPackageRequest, 'npm:foo@0.0.1');

  expect(resolver.name).toEqual('foo');
});

test('resolves scoped npm: package', () => {
  const resolver = new RegistryResolver(mockPackageRequest, 'npm:@org/foo@0.0.1');

  expect(resolver.name).toEqual('@org/foo');
});

test('resolves unscoped yarn: package', () => {
  const resolver = new RegistryResolver(mockPackageRequest, 'yarn:foo@0.0.1');

  expect(resolver.name).toEqual('foo');
});

test('resolves scoped yarn: package', () => {
  const resolver = new RegistryResolver(mockPackageRequest, 'yarn:@org/foo@0.0.1');

  expect(resolver.name).toEqual('@org/foo');
});

describe('RegistryResolver DOS regression test', () => {
  const MAX_MS = 200;

  test('long fragment without # should finish quickly and throw', () => {
    const fragment = '\u0000' + '\u0000:'.repeat(100000) + '\n1\n';
    const reqWithReporter: any = {
      reporter: {lang: (_key, frag) => `invalidFragment: ${String(frag).slice(0, 16)}...`},
    };

    const start = Date.now();
    expect(() => {
      new RegistryResolver((reqWithReporter: any), fragment);
    }).toThrow(MessageError);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(MAX_MS);
  });
});
