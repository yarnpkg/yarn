/* @flow */

import {getPackageVersion, runInstall} from '../_helpers.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

test.concurrent('installing with --package-date-limit should install the specified version of a package', () => {
  return runInstall({packageDateLimit: '2018-05-01T00:00:00.000Z'}, 'install-by-package-date-limit', async config => {
    expect(await getPackageVersion(config, 'trough')).toEqual('1.0.2');
  });
});

test.concurrent('installing without --package-date-limit should install the latest version of a package', () => {
  return runInstall({}, 'install-by-package-date-limit', async config => {
    expect(await getPackageVersion(config, 'trough')).toEqual('1.0.4');
  });
});
