/* @flow */

import type {PackageDriver} from 'pkg-tests-core';

const {
  fs: {writeFile, writeJson},
  tests: {getPackageArchivePath, getPackageHttpArchivePath, getPackageDirectoryPath},
} = require('pkg-tests-core');

module.exports = (makeTemporaryEnv: PackageDriver) => {
  describe(`Basic tests`, () => {
    test(
      `it should correctly install a single dependency that contains no sub-dependencies`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps`]: `1.0.0`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should correctly install a dependency that itself contains a fixed dependency`,
      makeTemporaryEnv(
        {
          dependencies: {[`one-fixed-dep`]: `1.0.0`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('one-fixed-dep')`)).resolves.toMatchObject({
            name: `one-fixed-dep`,
            version: `1.0.0`,
            dependencies: {
              [`no-deps`]: {
                name: `no-deps`,
                version: `1.0.0`,
              },
            },
          });
        },
      ),
    );

    test(
      `it should correctly install a dependency that itself contains a range dependency`,
      makeTemporaryEnv(
        {
          dependencies: {[`one-range-dep`]: `1.0.0`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('one-range-dep')`)).resolves.toMatchObject({
            name: `one-range-dep`,
            version: `1.0.0`,
            dependencies: {
              [`no-deps`]: {
                name: `no-deps`,
                version: `1.1.0`,
              },
            },
          });
        },
      ),
    );

    test(
      `it should correctly install an inter-dependency loop`,
      makeTemporaryEnv(
        {
          dependencies: {[`dep-loop-entry`]: `1.0.0`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(
            source(
              // eslint-disable-next-line
              `require('dep-loop-entry') === require('dep-loop-entry').dependencies['dep-loop-exit'].dependencies['dep-loop-entry']`,
            ),
          );
        },
      ),
    );

    test(
      `it should install from archives on the filesystem`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps`]: getPackageArchivePath(`no-deps`, `1.0.0`)},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should install the dependencies of any dependency fetched from the filesystem`,
      makeTemporaryEnv(
        {
          dependencies: {[`one-fixed-dep`]: getPackageArchivePath(`one-fixed-dep`, `1.0.0`)},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('one-fixed-dep')`)).resolves.toMatchObject({
            name: `one-fixed-dep`,
            version: `1.0.0`,
            dependencies: {
              [`no-deps`]: {
                name: `no-deps`,
                version: `1.0.0`,
              },
            },
          });
        },
      ),
    );

    test(
      `it should install from files on the internet`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps`]: getPackageHttpArchivePath(`no-deps`, `1.0.0`)},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should install the dependencies of any dependency fetched from the internet`,
      makeTemporaryEnv(
        {
          dependencies: {[`one-fixed-dep`]: getPackageHttpArchivePath(`one-fixed-dep`, `1.0.0`)},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('one-fixed-dep')`)).resolves.toMatchObject({
            name: `one-fixed-dep`,
            version: `1.0.0`,
            dependencies: {
              [`no-deps`]: {
                name: `no-deps`,
                version: `1.0.0`,
              },
            },
          });
        },
      ),
    );

    test(
      `it should install from local directories`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps`]: getPackageDirectoryPath(`no-deps`, `1.0.0`)},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should install the dependencies of any dependency fetched from a local directory`,
      makeTemporaryEnv(
        {
          dependencies: {[`one-fixed-dep`]: getPackageDirectoryPath(`one-fixed-dep`, `1.0.0`)},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('one-fixed-dep')`)).resolves.toMatchObject({
            name: `one-fixed-dep`,
            version: `1.0.0`,
            dependencies: {
              [`no-deps`]: {
                name: `no-deps`,
                version: `1.0.0`,
              },
            },
          });
        },
      ),
    );

    test(
      `it should correctly create resolution mounting points when using the link protocol`,
      makeTemporaryEnv(
        {
          dependencies: {[`link-dep`]: (async () => `link:${await getPackageDirectoryPath(`no-deps`, `1.0.0`)}`)()},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('link-dep')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should install in such a way that peer dependencies can be resolved (from top-level)`,
      makeTemporaryEnv(
        {
          dependencies: {[`peer-deps`]: `1.0.0`, [`no-deps`]: `1.0.0`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('peer-deps')`)).resolves.toMatchObject({
            name: `peer-deps`,
            version: `1.0.0`,
            peerDependencies: {
              [`no-deps`]: {
                name: `no-deps`,
                version: `1.0.0`,
              },
            },
          });
        },
      ),
    );

    test(
      `it should install in such a way that peer dependencies can be resolved (from within a dependency)`,
      makeTemporaryEnv(
        {
          dependencies: {[`custom-dep`]: `file:./custom-dep`},
        },
        async ({path, run, source}) => {
          await writeJson(`${path}/custom-dep/package.json`, {
            name: `custom-dep`,
            version: `1.0.0`,
            dependencies: {
              [`peer-deps`]: `1.0.0`,
              [`no-deps`]: `1.0.0`,
            },
          });

          await writeFile(
            `${path}/custom-dep/index.js`,
            `
            module.exports = require('peer-deps');
        `,
          );

          await run(`install`);

          await expect(source(`require('custom-dep')`)).resolves.toMatchObject({
            name: `peer-deps`,
            version: `1.0.0`,
            peerDependencies: {
              [`no-deps`]: {
                name: `no-deps`,
                version: `1.0.0`,
              },
            },
          });
        },
      ),
    );
  });
};
