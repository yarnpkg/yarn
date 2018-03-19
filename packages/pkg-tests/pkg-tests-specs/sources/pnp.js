const {fs: {writeFile, writeJson}, tests: {getPackageDirectoryPath}} = require('pkg-tests-core');

module.exports = makeTemporaryEnv => {
  const {basic: basicSpecs, script: scriptSpecs, workspace: workspaceSpecs} = require('pkg-tests-specs');

  describe(`Plug'n'Play`, () => {
    basicSpecs(
      makeTemporaryEnv.withConfig({
        plugNPlay: true,
      }),
    );

    scriptSpecs(
      makeTemporaryEnv.withConfig({
        plugNPlay: true,
      }),
    );

    workspaceSpecs(
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
        {
          plugNPlay: true,
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
        {
          plugNPlay: true,
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
      makeTemporaryEnv(
        {},
        {
          plugNPlay: true,
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('fs') ? true : false`)).resolves.toEqual(true);
        },
      ),
    );

    test(
      `it should correctly resolve relative imports`,
      makeTemporaryEnv(
        {},
        {
          plugNPlay: true,
        },
        async ({path, run, source}) => {
          await writeFile(`${path}/foo.js`, `module.exports = 42;\n`);

          await run(`install`);

          await expect(source(`require('./foo.js')`)).resolves.toEqual(42);
        },
      ),
    );

    test(
      `it should correctly resolve deep imports`,
      makeTemporaryEnv(
        {
          dependencies: {[`various-requires`]: `1.0.0`},
        },
        {
          plugNPlay: true,
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
        {
          plugNPlay: true,
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('various-requires/relative-require')`)).resolves.toEqual(42);
        },
      ),
    );

    test(
      `it should fallback to the top-level dependencies when it cannot require a transitive dependency require`,
      makeTemporaryEnv(
        {dependencies: {[`various-requires`]: `1.0.0`, [`no-deps`]: `1.0.0`}},
        {
          plugNPlay: true,
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('various-requires/invalid-require')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should throw an exception if a dependency tries to require something it doesn't own`,
      makeTemporaryEnv(
        {dependencies: {[`various-requires`]: `1.0.0`}},
        {
          plugNPlay: true,
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('various-requires/invalid-require')`)).rejects.toBeTruthy();
        },
      ),
    );

    test(
      `it should run scripts using a Node version that auto-injects the hook`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps`]: `1.0.0`},
          scripts: {myScript: `node -p 'require("no-deps/package.json").version'`},
        },
        {
          plugNPlay: true,
        },
        async ({path, run}) => {
          await run(`install`);

          await expect(run(`myScript`)).resolves.toMatchObject({
            stdout: `1.0.0\n`,
          });
        },
      ),
    );

    test(
      `it should install in such a way that two identical packages with different peer dependencies are different instances`,
      makeTemporaryEnv(
        {
          dependencies: {[`provides-peer-deps-1-0-0`]: `1.0.0`, [`provides-peer-deps-2-0-0`]: `1.0.0`},
        },
        {
          plugNPlay: true,
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(
            source(`require('provides-peer-deps-1-0-0') !== require('provides-peer-deps-2-0-0')`),
          ).resolves.toEqual(true);

          await expect(source(`require('provides-peer-deps-1-0-0')`)).resolves.toMatchObject({
            name: `provides-peer-deps-1-0-0`,
            version: `1.0.0`,
            dependencies: {
              [`peer-deps`]: {
                name: `peer-deps`,
                version: `1.0.0`,
                peerDependencies: {
                  [`no-deps`]: {
                    name: `no-deps`,
                    version: `1.0.0`,
                  },
                },
              },
              [`no-deps`]: {
                name: `no-deps`,
                version: `1.0.0`,
              },
            },
          });

          await expect(source(`require('provides-peer-deps-2-0-0')`)).resolves.toMatchObject({
            name: `provides-peer-deps-2-0-0`,
            version: `1.0.0`,
            dependencies: {
              [`peer-deps`]: {
                name: `peer-deps`,
                version: `1.0.0`,
                peerDependencies: {
                  [`no-deps`]: {
                    name: `no-deps`,
                    version: `2.0.0`,
                  },
                },
              },
              [`no-deps`]: {
                name: `no-deps`,
                version: `2.0.0`,
              },
            },
          });
        },
      ),
    );

    test(
      `it should support the use case of using the result of require.resolve(...) to load a package`,
      makeTemporaryEnv(
        {
          dependencies: {[`custom-dep-a`]: `file:./custom-dep-a`},
        },
        {
          plugNPlay: true,
        },
        async ({path, run, source}) => {
          await writeFile(
            `${path}/custom-dep-a/index.js`,
            `module.exports = require('custom-dep-b')(require.resolve('no-deps'))`,
          );
          await writeJson(`${path}/custom-dep-a/package.json`, {
            name: `custom-dep-a`,
            version: `1.0.0`,
            dependencies: {[`custom-dep-b`]: `file:../custom-dep-b`, [`no-deps`]: `1.0.0`},
          });

          await writeFile(`${path}/custom-dep-b/index.js`, `module.exports = path => require(path)`);
          await writeJson(`${path}/custom-dep-b/package.json`, {name: `custom-dep-b`, version: `1.0.0`});

          await run(`install`);

          await expect(source(`require('custom-dep-a')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should not break the tree path when loading through the result of require.resolve(...)`,
      makeTemporaryEnv(
        {
          dependencies: {[`custom-dep-a`]: `file:./custom-dep-a`},
        },
        {
          plugNPlay: true,
        },
        async ({path, run, source}) => {
          await writeFile(
            `${path}/custom-dep-a/index.js`,
            `module.exports = require('custom-dep-b')(require.resolve('custom-dep-c'))`,
          );
          await writeJson(`${path}/custom-dep-a/package.json`, {
            name: `custom-dep-a`,
            version: `1.0.0`,
            dependencies: {[`custom-dep-b`]: `file:../custom-dep-b`, [`custom-dep-c`]: `file:../custom-dep-c`},
          });

          await writeFile(`${path}/custom-dep-b/index.js`, `module.exports = path => require(path)`);
          await writeJson(`${path}/custom-dep-b/package.json`, {name: `custom-dep-b`, version: `1.0.0`});

          await writeFile(`${path}/custom-dep-c/index.js`, `module.exports = require('no-deps')`);
          await writeJson(`${path}/custom-dep-c/package.json`, {
            name: `custom-dep-c`,
            version: `1.0.0`,
            dependencies: {[`no-deps`]: `1.0.0`},
          });

          await run(`install`);

          await expect(source(`require('custom-dep-a')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
          });
        },
      ),
    );
  });
};
