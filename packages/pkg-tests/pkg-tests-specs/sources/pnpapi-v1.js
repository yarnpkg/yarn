const {fs: {writeFile, writeJson}} = require('pkg-tests-core');

module.exports = makeTemporaryEnv => {
  describe(`Plug'n'Play API (v1)`, () => {
    test(
      `it should expost VERSIONS`,
      makeTemporaryEnv({}, {plugNPlay: true}, async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`require('pnpapi').VERSIONS`)).resolves.toMatchObject({std: 1});
      }),
    );

    test(
      `it should expost resolveToUnqualified`,
      makeTemporaryEnv({}, {plugNPlay: true}, async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`typeof require('pnpapi').resolveToUnqualified`)).resolves.toEqual(`function`);
      }),
    );

    test(
      `it should expost resolveToUnqualified`,
      makeTemporaryEnv({}, {plugNPlay: true}, async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`typeof require('pnpapi').resolveUnqualified`)).resolves.toEqual(`function`);
      }),
    );

    test(
      `it should expost resolveToUnqualified`,
      makeTemporaryEnv({}, {plugNPlay: true}, async ({path, run, source}) => {
        await run(`install`);

        await expect(source(`typeof require('pnpapi').resolveRequest`)).resolves.toEqual(`function`);
      }),
    );

    describe(`resolveRequest`, () => {
      test(
        `it should return null for builtins`,
        makeTemporaryEnv({}, {plugNPlay: true}, async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('pnpapi').resolveRequest('fs', '${path}/')`)).resolves.toEqual(null);
        }),
      );

      test(
        `it should support the 'considerBuiltins' option`,
        makeTemporaryEnv(
          {
            dependencies: {[`fs`]: `link:./fs`},
          },
          {plugNPlay: true},
          async ({path, run, source}) => {
            await writeFile(`${path}/fs/index.js`, `module.exports = 'Hello world';`);
            await writeJson(`${path}/fs/package.json`, {
              name: `fs`,
              version: `1.0.0`,
            });

            await run(`install`);

            await expect(
              source(`require('pnpapi').resolveRequest('fs', '${path}/', {considerBuiltins: false})`),
            ).resolves.toEqual(`${path}/fs/index.js`);
          },
        ),
      );

      test(
        `it should support the 'extensions' option`,
        makeTemporaryEnv({}, {plugNPlay: true}, async ({path, run, source}) => {
          await writeFile(`${path}/foo.bar`, `hello world`);

          await run(`install`);

          await expect(
            source(`require('pnpapi').resolveRequest('./foo', '${path}/', {extensions: ['.bar']})`),
          ).resolves.toEqual(`${path}/foo.bar`);
        }),
      );
    });
  });
};
