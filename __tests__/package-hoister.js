/* @flow */

import PackageHoister, {HoistManifest} from '../src/package-hoister.js';
import type PackageResolver from '../src/package-resolver.js';
import type PackageReference from '../src/package-reference.js';
import type Config from '../src/config.js';
import type {Manifest} from '../src/types.js';

const path = require('path');

test('Produces valid destination paths for scoped modules', () => {
  const expected = path.join(__dirname, './node_modules/@scoped/dep');
  const scopedPackageName = '@scoped/dep';

  const config = (({
    cwd: __dirname,
    getFolder(): string {
      return 'node_modules';
    },
  }: any): Config);

  const resolver = (({}: any): PackageResolver);

  const key = scopedPackageName;
  const parts = [scopedPackageName];

  const pkg = (({
    _reference: (({}: any): PackageReference),
  }: any): Manifest);

  const info = new HoistManifest(key, parts, pkg, '', false, false);

  const tree = new Map([
    ['@scoped/dep', info],
  ]);

  const packageHoister = new PackageHoister(config, resolver, false);
  packageHoister.tree = tree;

  const result = packageHoister.init();
  const [actual] = result[0];

  expect(actual).toEqual(expected);
});
