import * as fsUtils   from 'miniyarn/utils/fs';
import * as testUtils from 'miniyarn/utils/test';

test.concurrent(`it should correctly resolve a semver range to a single version`, testUtils.makeTemporaryEnv({

    dependencies: { [`no-deps`]: `^1.0.0` }

}, async ({ path, run }) => {

    await run(`lock`);

    expect(await fsUtils.readJson(`${path}/yarn.json`)).toMatchObject({ dependencies: { [`no-deps`]: { reference: `1.1.0` } } });

}));
