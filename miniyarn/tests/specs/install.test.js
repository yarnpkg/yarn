import * as fsUtils   from 'miniyarn/utils/fs';
import * as testUtils from 'miniyarn/utils/test';
import * as yarnUtils from 'miniyarn/utils/yarn';

test.concurrent(`it should correctly install a single dependency that contains no sub-dependencies`, testUtils.makeTemporaryEnv({

    dependencies: { [`no-deps`]: `1.0.0` }

}, async ({ path, run }) => {

    await run(`install`);

    expect(await fsUtils.exists(`${path}/node_modules/no-deps/package.json`)).toEqual(true);

}));

test.concurrent(`it should correctly install a dependency that itself contains a fixed dependency`, testUtils.makeTemporaryEnv({

    dependencies: { [`one-fixed-dep`]: `1.0.0` }

}, async ({ path, run }) => {

    await run(`install`);

    expect(await fsUtils.exists(`${path}/node_modules/one-fixed-dep/package.json`)).toEqual(true);
    expect(await fsUtils.exists(`${path}/node_modules/one-fixed-dep/node_modules/no-deps/package.json`)).toEqual(true);

}));

test.concurrent(`it should correctly install a dependency that itself contains a range dependency`, testUtils.makeTemporaryEnv({

    dependencies: { [`one-range-dep`]: `1.0.0` }

}, async ({ path, run }) => {

    await run(`install`);

    expect(await fsUtils.exists(`${path}/node_modules/one-range-dep`)).toEqual(true);
    expect(await fsUtils.exists(`${path}/node_modules/one-range-dep/node_modules/no-deps/package.json`)).toEqual(true);

}));

test.concurrent(`it should respect any version locked in the yarn.json file, even if it mismatches with the package.json`, testUtils.makeTemporaryEnv({

    dependencies: { [`no-deps`]: `1.0.0` }

}, async ({ path, run }) => {

    await run(`lock`);

    await yarnUtils.updatePackageJson(path, packageJson => Object.assign(packageJson, { [`no-deps`]: `2.0.0` }));
    await fsUtils.rm(`${path}/node_modules`);

    await run(`install`);

    expect(await fsUtils.exists(`${path}/node_modules/no-deps/package.json`)).toEqual(true);
    expect(await fsUtils.readJson(`${path}/node_modules/no-deps/package.json`)).toMatchObject({ version: `1.0.0` });

}));

test.concurrent(`it should correctly install a dependency loop`, testUtils.makeTemporaryEnv({

    dependencies: { [`dep-loop-entry`]: `1.0.0` }

}, async ({ path, run }) => {

    await run(`install`);

    expect(await fsUtils.exists(`${path}/node_modules/dep-loop-entry/package.json`)).toEqual(true);
    expect(await fsUtils.exists(`${path}/node_modules/dep-loop-entry/node_modules/dep-loop-exit/package.json`)).toEqual(true);
    expect(await fsUtils.exists(`${path}/node_modules/dep-loop-entry/node_modules/dep-loop-exit/node_modules/dep-loop-entry/package.json`)).toEqual(false);

}));

test.concurrent(`should install our devDependencies when running in development mode`, testUtils.makeTemporaryEnv({

    devDependencies: { [`no-deps`]: `1.0.0` }

}, async ({ path, run }) => {

    await run(`install`);

    expect(await fsUtils.exists(`${path}/node_modules/no-deps/package.json`)).toEqual(true);

}));

test.concurrent(`should not install our devDependencies when running in production mode`, testUtils.makeTemporaryEnv({

    devDependencies: { [`no-deps`]: `1.0.0` }

}, async ({ path, run }) => {

    await run(`install`, `--production`);

    expect(await fsUtils.exists(`${path}/node_modules/no-deps/package.json`)).toEqual(false);

}));

test.concurrent(`should not install the devDependencies of our dependencies`, testUtils.makeTemporaryEnv({

    dependencies: { [`dev-deps`]: `1.0.0` }

}, async ({ path, run }) => {

    await run(`install`, `--production`);

    expect(await fsUtils.exists(`${path}/node_modules/dev-deps/package.json`)).toEqual(true);
    expect(await fsUtils.exists(`${path}/node_modules/dev-deps/node_modules/no-deps/package.json`)).toEqual(false);

    await fsUtils.rm(`${path}/node_modules`);

    await run(`install`);

    expect(await fsUtils.exists(`${path}/node_modules/dev-deps/package.json`)).toEqual(true);
    expect(await fsUtils.exists(`${path}/node_modules/dev-deps/node_modules/no-deps/package.json`)).toEqual(false);

}));

test.concurrent(`should install from archives on the filesystem`, testUtils.makeTemporaryEnv({

    dependencies: { [`no-deps`]: testUtils.getPackageArchivePath(`no-deps`, `1.0.0`) }

}, async ({ path, run }) => {

    await run(`install`);

    expect(await fsUtils.exists(`${path}/node_modules/no-deps/package.json`)).toEqual(true);

}));

test.concurrent(`should install the dependencies of any dependency fetched from the filesystem`, testUtils.makeTemporaryEnv({

    dependencies: { [`one-fixed-dep`]: testUtils.getPackageArchivePath(`one-fixed-dep`, `1.0.0`) }

}, async ({ path, run }) => {

    await run(`install`);

    expect(await fsUtils.exists(`${path}/node_modules/one-fixed-dep/package.json`)).toEqual(true);
    expect(await fsUtils.exists(`${path}/node_modules/one-fixed-dep/node_modules/no-deps/package.json`)).toEqual(true);

}));

test.concurrent(`should install from files on the internet`, testUtils.makeTemporaryEnv({

    dependencies: { [`no-deps`]: testUtils.getPackageHttpArchivePath(`no-deps`, `1.0.0`) }

}, async ({ path, run }) => {

    await run(`install`);

    expect(await fsUtils.exists(`${path}/node_modules/no-deps/package.json`)).toEqual(true);

}));

test.concurrent(`should install the dependencies of any dependency fetched from the internet`, testUtils.makeTemporaryEnv({

    dependencies: { [`one-fixed-dep`]: testUtils.getPackageHttpArchivePath(`one-fixed-dep`, `1.0.0`) }

}, async ({ path, run }) => {

    await run(`install`);

    expect(await fsUtils.exists(`${path}/node_modules/one-fixed-dep/package.json`)).toEqual(true);
    expect(await fsUtils.exists(`${path}/node_modules/one-fixed-dep/node_modules/no-deps/package.json`)).toEqual(true);

}));
