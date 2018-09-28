/* @flow */

import type {PackageDriver} from 'pkg-tests-core';

const {fs: {writeFile, writeJson}} = require('pkg-tests-core');

module.exports = (makeTemporaryEnv: PackageDriver) => {
  describe(`Workspaces tests`, () => {
    test(
      `it should implicitely make workspaces require-able from the top-level`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run, source}) => {
          await writeJson(`${path}/packages/workspace-a/package.json`, {
            name: `workspace-a`,
            version: `1.0.0`,
          });

          await writeFile(
            `${path}/packages/workspace-a/index.js`,
            `
              module.exports = 42;
            `,
          );

          await run(`install`);

          await expect(source(`require('workspace-a')`)).resolves.toEqual(42);
        },
      ),
    );

    test(
      `it should allow workspaces to require each others`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
          dependencies: {
            [`workspace-a`]: `1.0.0`,
            [`workspace-b`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await writeJson(`${path}/packages/workspace-a/package.json`, {
            name: `workspace-a`,
            version: `1.0.0`,
            dependencies: {
              [`workspace-a`]: `1.0.0`,
            },
          });

          await writeFile(
            `${path}/packages/workspace-a/index.js`,
            `
              module.exports = require('workspace-b/package.json');
            `,
          );

          await writeJson(`${path}/packages/workspace-b/package.json`, {
            name: `workspace-b`,
            version: `1.0.0`,
            dependencies: {
              [`workspace-b`]: `1.0.0`,
            },
          });

          await writeFile(
            `${path}/packages/workspace-b/index.js`,
            `
              module.exports = require('workspace-a/package.json');
            `,
          );

          await run(`install`);

          await expect(source(`require('workspace-a')`)).resolves.toMatchObject({
            name: `workspace-b`,
          });

          await expect(source(`require('workspace-b')`)).resolves.toMatchObject({
            name: `workspace-a`,
          });
        },
      ),
    );

    test(
      `it should resolve workspaces as regular packages if the versions don't match`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
          dependencies: {
            [`workspace`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await writeJson(`${path}/packages/workspace/package.json`, {
            name: `workspace`,
            version: `1.0.0`,
            dependencies: {
              [`no-deps`]: `2.0.0`,
            },
          });

          await writeFile(
            `${path}/packages/workspace/index.js`,
            `
              module.exports = require('no-deps/package.json');
            `,
          );

          await writeJson(`${path}/packages/no-deps/package.json`, {
            name: `no-deps`,
            version: `1.0.0`,
          });

          await run(`install`);

          await expect(source(`require('workspace')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `2.0.0`,
          });
        },
      ),
    );

    test(
      `it should allow scripts defined in workspaces to run successfully`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run, source}) => {
          await writeJson(`${path}/packages/workspace/package.json`, {
            name: `workspace`,
            version: `1.0.0`,
            dependencies: {
              [`has-bin-entries`]: `1.0.0`,
            },
          });

          await run(`install`);

          await expect(
            run(`run`, `has-bin-entries`, `foo`, {
              cwd: `${path}/packages/workspace`,
            }),
          ).resolves.toMatchObject({stdout: `foo\n`});
        },
      ),
    );
  });
};
