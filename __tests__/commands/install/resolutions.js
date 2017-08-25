/* @flow */

import {getPackageVersion, isPackagePresent, runInstall} from '../_helpers.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

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
    expect(await getPackageVersion(config, 'left-pad')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'd2')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'd2/left-pad')).toEqual('1.1.1');
    expect(await getPackageVersion(config, 'c')).toEqual('1.0.0');
    expect(await getPackageVersion(config, 'c/left-pad')).toEqual('1.1.2');
  });
});

test.concurrent('install with exotic resolutions should override versions', (): Promise<void> => {
  return runInstall({}, {source: 'resolutions', cwd: 'exotic-version'}, async config => {
    expect(await getPackageVersion(config, 'left-pad')).toEqual('1.1.1');
  });
});

test.concurrent('install with range resolutions should override versions', (): Promise<void> => {
  return runInstall({}, {source: 'resolutions', cwd: 'simple-range'}, async config => {
    expect(await getPackageVersion(config, 'left-pad')).toEqual('1.1.1');
  });
});
test.concurrent('should warn when resolution entries are incorrrect or incompatible', async (): Promise<void> => {
  let error;

  try {
    await runInstall({}, {source: 'resolutions', cwd: 'invalid-entries'});
  } catch (e) {
    error = e.message;
  }

  expect(error).toContain('Resolution field "left-pad@1.0.0" is incompatible with requested version "left-pad@~1.1.0');
  expect(error).toContain('Resolution field "wrongversion" has an invalid version entry and may be ignored');
  expect(error).toContain('Resolution field "invalidname/" does not end with a valid package name and will be ignored');
});

test.concurrent('install with resolutions should correctly install simple scoped packages', (): Promise<void> => {
  return runInstall({}, {source: 'resolutions', cwd: 'scoped-simple'}, async config => {
    expect(await getPackageVersion(config, '@scoped/a')).toEqual('1.0.0');
    expect(await getPackageVersion(config, '@scoped/b')).toEqual('2.0.0');
  });
});

test.concurrent('install with resolutions should correctly install toplevel scoped packages', (): Promise<void> => {
  return runInstall({}, {source: 'resolutions', cwd: 'scoped-toplevel'}, async config => {
    expect(await getPackageVersion(config, '@scoped/a')).toEqual('1.0.0');
    expect(await getPackageVersion(config, '@scoped/b')).toEqual('2.0.0');
  });
});
