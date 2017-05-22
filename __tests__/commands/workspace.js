// @flow

import {run as add} from '../../src/cli/commands/add.js';
import * as reporters from '../../src/reporters/index.js';
import * as fs from '../../src/util/fs.js';
import {makeConfigFromDirectory, runInstall} from './_helpers.js';

const stream = require('stream');

test('adds any new package to the current workspace, but install from the worktree', async () => {
  await runInstall({}, 'simple-worktree', async (config): Promise<void> => {
    const inOut = new stream.PassThrough();
    const reporter = new reporters.JSONReporter({stdout: inOut});

    expect(await fs.exists(`${config.cwd}/node_modules/left-pad`)).toEqual(false);
    expect(await fs.exists(`${config.cwd}/packages/package-a/node_modules/left-pad`)).toEqual(false);

    await add(await makeConfigFromDirectory(`${config.cwd}/packages/package-a`), reporter, {}, ['left-pad']);

    expect(await fs.exists(`${config.cwd}/node_modules/left-pad`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/package-a/node_modules/left-pad`)).toEqual(false);

    expect(await fs.exists(`${config.cwd}/yarn.lock`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/package-a/yarn.lock`)).toEqual(false);

    await add(await makeConfigFromDirectory(`${config.cwd}/packages/package-b`), reporter, {}, ['right-pad']);

    expect(await fs.exists(`${config.cwd}/node_modules/right-pad`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/package-b/node_modules/right-pad`)).toEqual(false);

    expect(await fs.exists(`${config.cwd}/yarn.lock`)).toEqual(true);
    expect(await fs.exists(`${config.cwd}/packages/package-b/yarn.lock`)).toEqual(false);
  });
});
