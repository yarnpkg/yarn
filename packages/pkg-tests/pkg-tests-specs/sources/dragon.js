/* @flow */

import type {PackageDriver} from 'pkg-tests-core';

const {fs: {writeFile, writeJson}} = require('pkg-tests-core');

// Here be dragons. The biggest and baddest tests, that just can't be described in a single line of summary. Because
// of this, they each must be clearly documented and explained.
//
// Because of their complexity, they generally have their own specific packages, which should NOT be renamed
// (some of these tests might rely on the package names being sorted in a certain way).

module.exports = (makeTemporaryEnv: PackageDriver) => {
  describe(`Dragon tests`, () => {
    test(
      `it should pass the dragon test 1`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`dragon-test-1-d`]: `1.0.0`,
            [`dragon-test-1-e`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          // This test assumes the following:
          //
          // . -> D@1.0.0 -> C@1.0.0 -> B@1.0.0 -> A@1.0.0
          //   -> E@1.0.0 -> B@2.0.0
          //              -> C@1.0.0 -> B@1.0.0 -> A@1.0.0
          //
          // This setup has the following properties:
          //
          //   - we have a package that can be hoisted (dragon-test-1-a, aka A)
          //   - its parent can NOT be hoisted (dragon-test-1-b, aka B)
          //   - its grandparent can be hoisted (dragon-test-1-c, aka C)
          //   - the D package prevents E>C from being pruned from the tree at resolution
          //
          // In this case, the package that can be hoisted will be hoisted to the
          // top-level while we traverse the D branch, then B as well, then C as
          // well. We then crawl the E branch: A is merged with the top-level A
          // (so we merge their hoistedFrom fields), then B cannot be hoisted
          // because its version conflict with the direct dependency of E (so
          // its hoistedFrom field stays where it is), then C will be merged
          // with the top-level C we already had, and its whole dependency branch
          // will be removed from the tree (including the B direct dependency that
          // has not been hoisted).
          //
          // Because of this, we end up having a hoistedFrom entry in A that
          // references E>C>B>A. When we try to link this to its parent (E>C>B), we
          // might then have a problem, because E>C>B doesn't exist anymore in the
          // tree (we removed it when we hoisted C).
          //
          // This test simply makes sure that this edge case doesn't crash the install.

          await run(`install`);
        },
      ),
    );

    test(
      `it should pass the dragon test 2`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`dragon-test-2-a`, `dragon-test-2-b`],
          dependencies: {
            [`dragon-test-2-a`]: `1.0.0`,
          },
        },
        {
          plugNPlay: true,
        },
        async ({path, run, source}) => {
          // This test assumes the following:
          //
          // . -> A@workspace -> B@workspace -> no-deps@* (peer dep)
          //                  -> no-deps@1.0.0
          //
          // In this situation, the implementation might register the workspaces one by
          // one, going through all their dependencies before moving to the next one.
          // Because the workspace B is also a dependency of the workspace A, it will be
          // traversed a first time as a dependency of A, and then a second time as a
          // workspace.
          //
          // A problem is when B also has peer dependencies, like in the setup described
          // above. In this case, the Yarn implementation of PnP needs to generate a virtual
          // package for B (in order to deambiguate the dependencies), and register it while
          // processing A. Then later, when iterating over B, it is possible that the
          // workspace registration overwrites the previously registered virtual dependency,
          // making it unavailable whilst still being referenced in the dependencies of A.
          //
          // This test ensures that A can always require B.

          await writeJson(`${path}/dragon-test-2-a/package.json`, {
            name: `dragon-test-2-a`,
            version: `1.0.0`,
            dependencies: {
              [`dragon-test-2-b`]: `1.0.0`,
              [`no-deps`]: `1.0.0`,
            },
          });

          await writeJson(`${path}/dragon-test-2-b/package.json`, {
            name: `dragon-test-2-b`,
            version: `1.0.0`,
            peerDependencies: {
              [`no-deps`]: `*`,
            },
          });

          await writeFile(`${path}/dragon-test-2-a/index.js`, `module.exports = require('dragon-test-2-b')`);
          await writeFile(`${path}/dragon-test-2-b/index.js`, `module.exports = require('no-deps')`);

          await run(`install`);

          await expect(source(`require("dragon-test-2-a")`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
          });
        },
      ),
    );
  });
};
