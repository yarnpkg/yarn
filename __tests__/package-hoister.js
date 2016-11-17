/* @flow */

import path from 'path';
import PackageHoister, {HoistManifest} from '../src/package-hoister.js';

const mockConfig = {
  cwd: __dirname,
  getFolder(): string {
    return 'node_modules';
  },
};

test('Produces valid destination paths for scoped modules', () => {
  const expected = path.join(__dirname, './node_modules/@scoped/dep');
  const scopedPackageName = '@scoped/dep';

  const key = scopedPackageName;
  const parts = [scopedPackageName];
  const pkg = {_reference: {}};
  const loc = null;
  const info = new HoistManifest(key, parts, pkg, loc);

  const tree = new Map([
    ['@scoped/dep', info],
  ]);

  const packageHoister = new PackageHoister(mockConfig);
  packageHoister.tree = tree;

  const result = packageHoister.init();
  const [actual] = result[0];

  expect(actual).toEqual(expected);
});
