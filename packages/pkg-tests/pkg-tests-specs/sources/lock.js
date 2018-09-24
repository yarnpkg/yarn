/* @flow */

import type {PackageDriver} from 'pkg-tests-core';

const {fs: {writeFile, writeJson}, tests: {setPackageWhitelist}} = require('pkg-tests-core');

module.exports = (makeTemporaryEnv: PackageDriver) => {
  describe(`Lock tests`, () => {
    test(
      `it should correctly lock dependencies`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps`]: `^1.0.0`},
        },
        async ({path, run, source}) => {
          await setPackageWhitelist(new Map([[`no-deps`, new Set([`1.0.0`])]]), async () => {
            await run(`install`);
          });
          await setPackageWhitelist(new Map([[`no-deps`, new Set([`1.0.0`, `1.1.0`])]]), async () => {
            await run(`install`, `-f`);
          });
          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
          });
        },
      ),
    );
  });
};
