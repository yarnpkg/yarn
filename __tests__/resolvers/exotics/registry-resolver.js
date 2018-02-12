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
