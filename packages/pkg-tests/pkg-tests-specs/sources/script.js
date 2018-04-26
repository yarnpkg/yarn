/* @flow */

import type {PackageDriver} from 'pkg-tests-core';

const {fs: {makeFakeBinary}} = require(`pkg-tests-core`);

module.exports = (makeTemporaryEnv: PackageDriver) => {
  describe(`Scripts tests`, () => {
    test(
      `it should run scripts using the same Node than the one used by Yarn`,
      makeTemporaryEnv({scripts: {myScript: `node --version`}}, async ({path, run, source}) => {
        await makeFakeBinary(`${path}/bin/node`);

        await expect(run(`run`, `myScript`)).resolves.toMatchObject({
          stdout: `${process.version}\n`,
        });
      }),
    );
  });
};
