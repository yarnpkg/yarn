// Here be dragons. The biggest and baddest tests, that just can't be described in a single line of summary. Because
// of this, they each must be clearly documented and explained.
//
// Because of their complexity, they generally have their own specific packages, which should NOT be renamed
// (some of these tests might rely on the package names being sorted in a certain way).

module.exports = makeTemporaryEnv => {
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
        async ({path, run}) => {
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
  });
};
