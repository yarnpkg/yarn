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

test('Regex Dos', () => {
  const nativeFs = require('fs');
  const os = require('os');

  const bundle = '' + '-----BEGIN '.repeat(50000) + '\r';
  const tmp = path.join(os.tmpdir(), `cafile-${Date.now()}.pem`);
  nativeFs.writeFileSync(tmp, bundle, 'utf8');

  const rm = new RequestManager((new Reporter(): any));

  const start = Date.now();
  rm.setOptions({userAgent: 'ua/1.0', strictSSL: false, cafile: tmp});
  const duration = Date.now() - start;

  expect(duration).toBeLessThan(3000);

  try {
    nativeFs.unlinkSync(tmp);
  } catch (_) {}
});
