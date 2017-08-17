/* @flow */
/* eslint max-len: 0 */

import execa from 'execa';
import makeTemp from './_temp.js';
import * as fs from '../src/util/fs.js';
import * as misc from '../src/util/misc.js';
import * as constants from '../src/constants.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const path = require('path');

function addTest(pattern) {
  // concurrently network requests tend to stall
  test(`yarn add ${pattern}`, async () => {
    const cwd = await makeTemp();
    const cacheFolder = path.join(cwd, 'cache');

    const command = path.resolve(__dirname, '../bin/yarn');
    const args = ['--cache-folder', cacheFolder, '--verbose'];

    const options = {cwd};

    await fs.writeFile(path.join(cwd, 'package.json'), JSON.stringify({name: 'test'}));

    await execa(command, ['add', pattern].concat(args), options);

    await fs.unlink(cwd);
  });
}

// TODO:
// addTest('gitlab:leanlabsio/kanban'); // gitlab
// addTest(
//   '@foo/bar@1.2.3',
//   async cacheFolder => {
//     const folder = path.join(cacheFolder, 'v1', 'npm-@foo', 'bar');
//     await fs.mkdirp(folder);
//     await fs.writeFile(
//       path.join(folder, constants.METADATA_FILENAME),
//       '{"remote": {"hash": "cafebabecafebabecafebabecafebabecafebabe"}}',
//     );
//     await fs.writeFile(path.join(folder, 'package.json'), '{"name": "@foo/bar", "version": "1.2.3"}');
//   },
//   true,
// ); // offline npm scoped package

addTest('scrollin'); // npm
addTest('https://git@github.com/stevemao/left-pad.git'); // git url, with username
addTest('https://github.com/yarnpkg/yarn/releases/download/v0.18.1/yarn-v0.18.1.tar.gz'); // tarball
addTest('https://github.com/bestander/chrome-app-livereload.git'); // no package.json
addTest('bestander/chrome-app-livereload'); // no package.json, github, tarball

const MIN_PORT_NUM = 1024;
const MAX_PORT_NUM = 65535;
const PORT_RANGE = MAX_PORT_NUM - MIN_PORT_NUM;

const getRandomPort = () => Math.floor(Math.random() * PORT_RANGE) + MIN_PORT_NUM;

test('--mutex network', async () => {
  const cwd = await makeTemp();
  const cacheFolder = path.join(cwd, '.cache');

  const command = path.resolve(__dirname, '../bin/yarn');
  const args = ['--cache-folder', cacheFolder, '--verbose', '--mutex', `network:${getRandomPort()}`];

  const options = {cwd};

  await Promise.all([
    execa(command, ['add', 'left-pad'].concat(args), options),
    execa(command, ['add', 'foo'].concat(args), options),
  ]);
});

test('cache folder fallback', async () => {
  const cwd = await makeTemp();
  const cacheFolder = path.join(cwd, '.cache');

  const command = path.resolve(__dirname, '../bin/yarn');
  const args = ['--preferred-cache-folder', cacheFolder];

  const options = {cwd};

  function runCacheDir(): Promise<Array<Buffer>> {
    const {stderr, stdout} = execa(command, ['cache', 'dir'].concat(args), options);

    const stdoutPromise = misc.consumeStream(stdout);
    const stderrPromise = misc.consumeStream(stderr);

    return Promise.all([stdoutPromise, stderrPromise]);
  }

  const [stdoutOutput, stderrOutput] = await runCacheDir();

  expect(stdoutOutput.toString().trim()).toEqual(path.join(cacheFolder, `v${constants.CACHE_VERSION}`));
  expect(stderrOutput.toString()).not.toMatch(/Skipping preferred cache folder/);

  await fs.unlink(cacheFolder);
  await fs.writeFile(cacheFolder, `not a directory`);

  const [stdoutOutput2, stderrOutput2] = await runCacheDir();

  expect(stdoutOutput2.toString().trim()).toEqual(
    path.join(constants.PREFERRED_MODULE_CACHE_DIRECTORIES[0], `v${constants.CACHE_VERSION}`),
  );
  expect(stderrOutput2.toString()).toMatch(/Skipping preferred cache folder/);
});
