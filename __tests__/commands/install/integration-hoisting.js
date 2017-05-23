/* @flow */

import {getPackageVersion, runInstall} from '../_helpers.js';
import * as fs from '../../../src/util/fs.js';

const path = require('path');

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

test.concurrent(
  'install hoister should not install prioritised popular transitive devDependencies in --prod mode',
  (): Promise<void> => {
    return runInstall({production: true}, 'install-prod-prioritized-popular-transitive-dev-dep', async config => {
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'a'))).toEqual(false);
      expect(await fs.exists(path.join(config.cwd, 'node_modules', 'b'))).toEqual(false);
    });
  },
);
