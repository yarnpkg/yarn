/* @flow */

import {getPackageVersion, isPackagePresent, runInstall} from '../_helpers.js';

test.concurrent('install with simple exact resolutions should override all versions', (): Promise<void> => {
  return runInstall({}, {source: 'resolutions', cwd: 'simple-exact'}, async config => {
    expect(await getPackageVersion(config, 'a')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'b')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'd1')).toEqual('2.0.0');
    expect(await getPackageVersion(config, 'd2')).toEqual('1.0.0');
    expect(await isPackagePresent(config, 'a/d1')).toEqual(false);
    expect(await isPackagePresent(config, 'a/d2')).toEqual(false);
    expect(await isPackagePresent(config, 'b/d1')).toEqual(false);
    expect(await isPackagePresent(config, 'b/d2')).toEqual(false);
  });
});

test.concurrent('install with subtree exact resolutions should override subtree versions', (): Promise<void> => {
  return runInstall({}, {source: 'resolutions', cwd: 'subtree-exact'}, async config => {
    expect(await getPackageVersion(config, 'a')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'b')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'd1')).toEqual('3.0.0');
    expect(await getPackageVersion(config, 'b/d1')).toEqual('2.0.0');
    expect(await getPackageVersion(config, 'd2')).toEqual('1.0.0');
    expect(await isPackagePresent(config, 'a/d1')).toEqual(false);
    expect(await isPackagePresent(config, 'a/d2')).toEqual(false);
    expect(await isPackagePresent(config, 'b/d2')).toEqual(false);
  });
});
