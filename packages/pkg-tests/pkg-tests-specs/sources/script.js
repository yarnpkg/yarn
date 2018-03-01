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
    test(
      `it should run scripts using the same package manager than the one running the scripts`,
      makeTemporaryEnv({scripts: {myScript: `yarn --version`}}, async ({path, run, source}) => {
        await makeFakeBinary(`${path}/bin/yarn`);

        await expect(run(`run`, `myScript`)).resolves.toMatchObject({
          stdout: (await run(`--version`)).stdout,
        });
      }),
    );
  });
};
