const {fs: {writeFile}, tests: {getPackageDirectoryPath}} = require('pkg-tests-core');
const {basic: basicSpecs} = require('pkg-tests-specs');

module.exports = makeTemporaryEnv => {
  describe(`Plug'n'Play`, () => {
    basicSpecs(
      makeTemporaryEnv.withConfig({
        plugNPlay: true,
      }),
    );

    test(
      `it should resolve two identical packages with the same object (easy)`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`one-fixed-dep-1`]: getPackageDirectoryPath(`one-fixed-dep`, `1.0.0`),
            [`one-fixed-dep-2`]: getPackageDirectoryPath(`one-fixed-dep`, `1.0.0`),
            [`no-deps`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(
            source(`require('one-fixed-dep-1').dependencies['no-deps'] === require('no-deps')`),
          ).resolves.toEqual(true);
          await expect(
            source(`require('one-fixed-dep-2').dependencies['no-deps'] === require('no-deps')`),
          ).resolves.toEqual(true);
        },
      ),
    );

    test(
      `it should resolve two identical packages with the same object (complex)`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`one-fixed-dep-1`]: getPackageDirectoryPath(`one-fixed-dep`, `1.0.0`),
            [`one-fixed-dep-2`]: getPackageDirectoryPath(`one-fixed-dep`, `1.0.0`),
            [`no-deps`]: `2.0.0`,
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(
            source(
              `require('one-fixed-dep-1').dependencies['no-deps'] === require('one-fixed-dep-2').dependencies['no-deps']`,
            ),
          ).resolves.toEqual(true);

          await expect(
            source(`require('one-fixed-dep-1').dependencies['no-deps'] !== require('no-deps')`),
          ).resolves.toEqual(true);
          await expect(
            source(`require('one-fixed-dep-2').dependencies['no-deps'] !== require('no-deps')`),
          ).resolves.toEqual(true);
        },
      ),
    );

    test(
      `it should correctly resolve native Node modules`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('fs') ? true : false`)).resolves.toEqual(true);
      }),
    );

    test(
      `it should correctly resolve relative imports`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await writeFile(`${path}/foo.js`, `module.exports = 42;\n`);

        await run(`install`);

        await expect(source(`require('./foo.js')`)).resolves.toEqual(42);
      }),
    );

    test(
      `it should correctly resolve deep imports`,
      makeTemporaryEnv(
        {
          dependencies: {[`various-requires`]: `1.0.0`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('various-requires/alternative-index')`)).resolves.toEqual(42);
        },
      ),
    );

    test(
      `it should correctly resolve relative imports from within dependencies`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`various-requires`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('various-requires/relative-require')`)).resolves.toEqual(42);
        },
      ),
    );

    test(
      `it should throw an exception if a dependency tries to require something it doesn't own`,
      makeTemporaryEnv(
        {dependencies: {[`various-requires`]: `1.0.0`, [`no-deps`]: `1.0.0`}},
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('various-requires/invalid-require')`)).rejects.toBeTruthy();
        },
      ),
    );
  });
};
