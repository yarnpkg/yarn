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

    test(
      `it should run declared scripts`,
      makeTemporaryEnv(
        {
          scripts: {
            [`foobar`]: `echo test successful`,
          },
        },
        async ({path, run, source}) => {
          await expect(run(`run`, `foobar`)).resolves.toMatchObject({
            stdout: `test successful\n`,
          });
        },
      ),
    );

    test(
      `it should expose its dependencies within the $PATH`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`has-bin-entries`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(run(`run`, `has-bin-entries`, `success`)).resolves.toMatchObject({
            stdout: `success\n`,
          });
        },
      ),
    );

    test(
      `it shouldn't require the "--" flag to stop interpreting options after "run" commands`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`has-bin-entries`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(run(`run`, `has-bin-entries`, `--hello`)).resolves.toMatchObject({
            stdout: `--hello\n`,
          });
        },
      ),
    );

    test(
      `it should allow dependencies binaries to require their own dependencies`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`has-bin-entries`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(run(`run`, `has-bin-entries-with-require`)).resolves.toMatchObject({
            stdout: `no-deps\n1.0.0\n`,
          });
        },
      ),
    );
  });
};
