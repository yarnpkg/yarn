/* @flow */
/* eslint max-len: 0 */

import execa from 'execa';
import {sh} from 'puka';
import makeTemp from './_temp.js';
import * as fs from '../src/util/fs.js';
import * as constants from '../src/constants.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

const path = require('path');

function addTest(pattern, {strict} = {strict: false}) {
  test.concurrent(`yarn add ${pattern}`, async () => {
    const cwd = await makeTemp();
    const cacheFolder = path.join(cwd, 'cache');

    const command = path.resolve(__dirname, '../bin/yarn');
    const args = ['--cache-folder', cacheFolder];

    const options = {cwd};

    await fs.writeFile(
      path.join(cwd, 'package.json'),
      JSON.stringify({
        name: 'test',
        license: 'MIT',
      }),
    );

    const result = await execa(command, ['add', pattern].concat(args), options);
    if (strict) {
      expect(result.stderr).not.toMatch(/^warning /gm);
    }

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
//     await fs.writeFile(path.join(foldresolve gitlab:leanlabsio/kanbaner, 'package.json'), '{"name": "@foo/bar", "version": "1.2.3"}');
//   },
//   true,
// ); // offline npm scoped package

addTest('scrollin'); // npm
addTest('https://git@github.com/stevemao/left-pad.git'); // git url, with username
addTest('https://github.com/yarnpkg/yarn/releases/download/v0.18.1/yarn-v0.18.1.tar.gz'); // tarball
addTest('https://github.com/bestander/chrome-app-livereload.git'); // no package.json
addTest('bestander/chrome-app-livereload'); // no package.json, github, tarball
// Only run `react-scripts` test on Node 6+
if (parseInt(process.versions.node.split('.')[0], 10) >= 6) {
  addTest('react-scripts@1.0.13', {strict: true}); // many peer dependencies, there shouldn't be any peerDep warnings
}

const MIN_PORT_NUM = 56000;
const MAX_PORT_NUM = 65535;
const PORT_RANGE = MAX_PORT_NUM - MIN_PORT_NUM;

const getRandomPort = () => Math.floor(Math.random() * PORT_RANGE) + MIN_PORT_NUM;

async function runYarn(args: Array<string> = [], options: Object = {}): Promise<Array<Buffer>> {
  if (!options['env']) {
    options['env'] = {...process.env};
    options['extendEnv'] = false;
  }
  options['env']['FORCE_COLOR'] = 0;
  const {stdout, stderr} = await execa.shell(sh`${path.resolve(__dirname, '../bin/yarn')} ${args}`, options);

  return [stdout, stderr];
}

describe('production', () => {
  test('it should be true when NODE_ENV=production', async () => {
    const cwd = await makeTemp();
    const options = {cwd, env: {YARN_SILENT: 1, NODE_ENV: 'production'}};

    const [stdoutOutput, _] = await runYarn(['config', 'current'], options);

    expect(JSON.parse(stdoutOutput.toString())).toHaveProperty('production', true);
  });

  test('it should default to false', async () => {
    const cwd = await makeTemp();
    const options = {cwd, env: {YARN_SILENT: 1, NODE_ENV: ''}};

    const [stdoutOutput, _] = await runYarn(['config', 'current'], options);

    expect(JSON.parse(stdoutOutput.toString())).toHaveProperty('production', false);
  });

  test('it should prefer CLI over NODE_ENV', async () => {
    const cwd = await makeTemp();
    const options = {cwd, env: {YARN_SILENT: 1, NODE_ENV: 'production'}};

    const [stdoutOutput, _] = await runYarn(['--prod', 'false', 'config', 'current'], options);

    expect(JSON.parse(stdoutOutput.toString())).toHaveProperty('production', false);
  });

  test('it should prefer YARN_PRODUCTION over NODE_ENV', async () => {
    const cwd = await makeTemp();
    const options = {cwd, env: {YARN_SILENT: 1, YARN_PRODUCTION: 'false', NODE_ENV: 'production'}};

    const [stdoutOutput, _] = await runYarn(['config', 'current'], options);

    expect(JSON.parse(stdoutOutput.toString())).toHaveProperty('production', false);
  });

  test('it should prefer CLI over YARN_PRODUCTION', async () => {
    const cwd = await makeTemp();
    const options = {cwd, env: {YARN_SILENT: 1, YARN_PRODUCTION: 'false', NODE_ENV: 'production'}};

    const [stdoutOutput, _] = await runYarn(['--prod', '1', 'config', 'current'], options);

    expect(JSON.parse(stdoutOutput.toString())).toHaveProperty('production', true);
  });
});

test('--mutex network', async () => {
  const cwd = await makeTemp();

  const port = getRandomPort();
  await fs.writeFile(path.join(cwd, '.yarnrc'), `--mutex "network:${port}"\n`);

  const promises = [];

  for (let t = 0; t < 40; ++t) {
    const subCwd = path.join(cwd, String(t));

    await fs.mkdirp(subCwd);
    await fs.writeFile(
      path.join(subCwd, 'package.json'),
      JSON.stringify({
        scripts: {test: 'node -e "setTimeout(function(){}, process.argv[1])"'},
      }),
    );

    promises.push(runYarn(['run', 'test', '100'], {cwd: subCwd}));
  }

  await Promise.all(promises);
});

test('--cwd option', async () => {
  const cwd = await makeTemp();

  const subdir = path.join(cwd, 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i');
  await fs.mkdirp(subdir);

  const packageJsonPath = path.join(cwd, 'package.json');
  await fs.writeFile(packageJsonPath, JSON.stringify({}));

  await runYarn(['add', 'left-pad'], {cwd: subdir});

  const packageJson = JSON.parse(await fs.readFile(packageJsonPath));
  expect(packageJson.dependencies['left-pad']).toBeDefined();
});

test('yarnrc arguments', async () => {
  const cwd = await makeTemp();

  await fs.writeFile(
    `${cwd}/.yarnrc`,
    ['--emoji false', '--json true', '--add.exact true', '--no-progress true', '--cache-folder "./yarn-cache"'].join(
      '\n',
    ),
  );
  await fs.writeFile(`${cwd}/package.json`, JSON.stringify({name: 'test', license: 'ISC', version: '1.0.0'}));

  const [stdoutOutput] = await runYarn(['add', 'left-pad'], {cwd});
  expect(stdoutOutput).toMatchSnapshot('yarnrc-args');
  expect(JSON.parse(await fs.readFile(`${cwd}/package.json`)).dependencies['left-pad']).toMatch(/^\d+\./);
  expect((await fs.stat(`${cwd}/yarn-cache`)).isDirectory()).toBe(true);
});

test('yarnrc binary path (js)', async () => {
  const cwd = await makeTemp();

  await fs.writeFile(`${cwd}/.yarnrc`, 'yarn-path "./override.js"\n');
  await fs.writeFile(`${cwd}/override.js`, 'console.log("override called")\n');

  const [stdoutOutput] = await runYarn([], {cwd});
  expect(stdoutOutput.toString().trim()).toEqual('override called');
});

test('yarnrc binary path (executable)', async () => {
  const cwd = await makeTemp();

  if (process.platform === 'win32') {
    await fs.writeFile(`${cwd}/.yarnrc`, 'yarn-path "./override.cmd"\n');
    await fs.writeFile(`${cwd}/override.cmd`, '@echo override called\n');
  } else {
    await fs.writeFile(`${cwd}/.yarnrc`, 'yarn-path "./override"\n');
    await fs.writeFile(`${cwd}/override`, '#!/usr/bin/env sh\necho override called\n');
    await fs.chmod(`${cwd}/override`, 0o755);
  }

  const [stdoutOutput] = await runYarn([], {cwd});
  expect(stdoutOutput.toString().trim()).toEqual('override called');
});

for (const withDoubleDash of [false, true]) {
  test(`yarn run <script> ${withDoubleDash ? '-- ' : ''}--opt`, async () => {
    const cwd = await makeTemp();

    await fs.writeFile(
      path.join(cwd, 'package.json'),
      JSON.stringify({
        scripts: {echo: `echo`},
      }),
    );

    const options = {cwd, env: {YARN_SILENT: 1}};

    const [stdoutOutput, stderrOutput] = await runYarn(
      ['run', 'echo', ...(withDoubleDash ? ['--'] : []), '--opt'],
      options,
    );

    expect(stdoutOutput.toString().trim()).toEqual('--opt');
    (exp => (withDoubleDash ? exp : exp.not))(expect(stderrOutput.toString())).toMatch(
      /From Yarn 1\.0 onwards, scripts don't require "--" for options to be forwarded/,
    );
  });
}

test('yarn run <script> <strings that need escaping>', async () => {
  const cwd = await makeTemp();

  await fs.writeFile(
    path.join(cwd, 'package.json'),
    JSON.stringify({
      scripts: {stringify: `node -p "JSON.stringify(process.argv.slice(1))"`},
    }),
  );

  const options = {cwd, env: {YARN_SILENT: 1}};

  const trickyStrings = ['$PWD', '%CD%', '^', '!', '\\', '>', '<', '|', '&', "'", '"', '`', '  '];
  const [stdout] = await runYarn(['stringify', ...trickyStrings], options);

  expect(stdout.toString().trim()).toEqual(JSON.stringify(trickyStrings));
});

test('cache folder fallback', async () => {
  const cwd = await makeTemp();
  const cacheFolder = path.join(cwd, '.cache');

  const args = ['--preferred-cache-folder', cacheFolder];
  const options = {cwd};

  const runCacheDir = () => {
    return runYarn(['cache', 'dir'].concat(args), options);
  };

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

test('yarn create', async () => {
  const cwd = await makeTemp();
  const options = {cwd, env: {YARN_SILENT: 1}};

  const [stdoutOutput, _] = await runYarn(['create', 'html'], options);

  expect(stdoutOutput.toString()).toMatch(/<!doctype html>/);
});
