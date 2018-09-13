/* @flow */
/* eslint max-len: 0 */

import http from 'http';
import {existsSync} from 'fs';

import invariant from 'invariant';
import execa from 'execa';
import {sh} from 'puka';
import makeTemp from './_temp.js';
import * as fs from '../src/util/fs.js';
import * as constants from '../src/constants.js';
import {explodeLockfile} from './commands/_helpers.js';
import en from '../src/reporters/lang/en.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

const path = require('path');

if (!existsSync(path.resolve(__dirname, '../lib'))) {
  throw new Error('These tests require `yarn build` to have been run first.');
}

function addTest(pattern, {strictPeers} = {strictPeers: false}, yarnArgs: Array<string> = []) {
  test.concurrent(`yarn add ${pattern}`, async () => {
    const cwd = await makeTemp();
    const cacheFolder = path.join(cwd, 'cache');

    const command = path.resolve(__dirname, '../bin/yarn');
    const args = ['--cache-folder', cacheFolder, ...yarnArgs];

    const options = {cwd};

    await fs.writeFile(
      path.join(cwd, 'package.json'),
      JSON.stringify({
        name: 'test',
        license: 'MIT',
      }),
    );

    const result = await execa(command, ['add', pattern].concat(args), options);
    if (strictPeers) {
      expect(result.stderr).not.toMatch(/^warning .+ peer dependency/gm);
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
addTest('https://github.com/bestander/chrome-app-livereload.git'); // no package.json
addTest('bestander/chrome-app-livereload'); // no package.json, github, tarball

if (process.platform !== 'win32') {
  addTest('https://github.com/yarnpkg/yarn/releases/download/v0.18.1/yarn-v0.18.1.tar.gz'); // tarball
  addTest('react-scripts@1.0.13', {strictPeers: true}, ['--no-node-version-check', '--ignore-engines']); // many peer dependencies, there shouldn't be any peerDep warnings
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

test('--mutex network with busy port', async () => {
  const port = getRandomPort();

  const server = http.createServer((request, response) => {
    response.writeHead(200);
    response.end("I'm a broken JSON string to crash Yarn network mutex.");
  });
  server.listen({
    port,
    host: 'localhost',
  });

  const cwd = await makeTemp();
  await fs.writeFile(
    path.join(cwd, 'package.json'),
    JSON.stringify({
      scripts: {test: 'node -e "setTimeout(function(){}, process.argv[1])"'},
    }),
  );

  let mutexError;
  try {
    await runYarn(['--mutex', `network:${port}`, 'run', 'test', '100'], {cwd});
  } catch (error) {
    mutexError = error;
  } finally {
    server.close();
  }

  expect(mutexError).toBeDefined();
  invariant(mutexError != null, 'mutexError should be defined at this point otherwise Jest will throw above');
  expect(mutexError.message).toMatch(new RegExp(en.mutexPortBusy.replace(/\$\d/g, '\\d+')));
});

describe('--registry option', () => {
  test('--registry option with npm registry', async () => {
    const cwd = await makeTemp();

    const registry = 'https://registry.npmjs.org';
    const packageJsonPath = path.join(cwd, 'package.json');
    await fs.writeFile(packageJsonPath, JSON.stringify({}));

    await runYarn(['add', 'left-pad', '--registry', registry], {cwd});

    const packageJson = JSON.parse(await fs.readFile(packageJsonPath));
    const lockfile = explodeLockfile(await fs.readFile(path.join(cwd, 'yarn.lock')));

    expect(packageJson.dependencies['left-pad']).toBeDefined();
    expect(lockfile).toHaveLength(4);
    expect(lockfile[2]).toContain(registry);
  });

  test('--registry option with yarn registry', async () => {
    const cwd = await makeTemp();

    const registry = 'https://registry.yarnpkg.com';
    const packageJsonPath = path.join(cwd, 'package.json');
    await fs.writeFile(packageJsonPath, JSON.stringify({}));

    await runYarn(['add', 'is-array', '--registry', registry], {cwd});

    const packageJson = JSON.parse(await fs.readFile(packageJsonPath));
    const lockfile = explodeLockfile(await fs.readFile(path.join(cwd, 'yarn.lock')));

    expect(packageJson.dependencies['is-array']).toBeDefined();
    expect(lockfile).toHaveLength(4);
    expect(lockfile[2]).toContain(registry);
  });

  test('--registry option with non-exiting registry and show an error', async () => {
    const cwd = await makeTemp();
    const registry = 'https://example-registry-doesnt-exist.com';

    try {
      await runYarn(['add', 'is-array', '--registry', registry], {cwd});
    } catch (err) {
      const stdoutOutput = err.message;
      expect(stdoutOutput.toString()).toMatch(/getaddrinfo ENOTFOUND example-registry-doesnt-exist\.com/g);
    }
  });

  test('registry option from yarnrc', async () => {
    const cwd = await makeTemp();

    const registry = 'https://registry.npmjs.org';
    await fs.writeFile(`${cwd}/.yarnrc`, 'registry "' + registry + '"\n');

    const packageJsonPath = path.join(cwd, 'package.json');
    await fs.writeFile(packageJsonPath, JSON.stringify({}));

    await runYarn(['add', 'left-pad'], {cwd});

    const packageJson = JSON.parse(await fs.readFile(packageJsonPath));
    const lockfile = explodeLockfile(await fs.readFile(path.join(cwd, 'yarn.lock')));

    expect(packageJson.dependencies['left-pad']).toBeDefined();
    expect(lockfile).toHaveLength(4);
    expect(lockfile[2]).toContain(registry);
  });
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

const customCacheCwd = `${__dirname}/fixtures/cache/custom-location`;

test('default rc', async (): Promise<void> => {
  const [stdoutOutput] = await runYarn(['cache', 'dir'], {cwd: customCacheCwd});

  expect(stdoutOutput).toMatch(/uses-default-yarnrc/);
});

test('--no-default-rc', async (): Promise<void> => {
  const [stdoutOutput] = await runYarn(['cache', 'dir', '--no-default-rc'], {cwd: customCacheCwd});

  expect(stdoutOutput).not.toMatch(/uses-default-yarnrc/);
});

test('--use-yarnrc', async (): Promise<void> => {
  const [stdoutOutput] = await runYarn(['cache', 'dir', '--use-yarnrc', './custom-yarnrc'], {cwd: customCacheCwd});

  expect(stdoutOutput).toMatch(/uses-custom-yarnrc/);
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

  const [stdoutOutput] = await runYarn(['add', 'left-pad@1.1.3'], {cwd});
  expect(stdoutOutput).toMatchSnapshot('yarnrc-args');
  expect(JSON.parse(await fs.readFile(`${cwd}/package.json`)).dependencies['left-pad']).toMatch(/^\d+\./);
  expect((await fs.stat(`${cwd}/yarn-cache`)).isDirectory()).toBe(true);
});

describe('yarnrc path', () => {
  test('js file', async () => {
    const cwd = await makeTemp();

    await fs.writeFile(`${cwd}/.yarnrc`, 'yarn-path "./override.js"\n');
    await fs.writeFile(`${cwd}/override.js`, 'console.log("override called")\n');

    const [stdoutOutput] = await runYarn([], {cwd});
    expect(stdoutOutput.toString().trim()).toEqual('override called');
  });

  test('executable file', async () => {
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

  test('js file exit code', async () => {
    const cwd = await makeTemp();

    await fs.writeFile(`${cwd}/.yarnrc`, 'yarn-path "./override.js"\n');
    await fs.writeFile(`${cwd}/override.js`, 'process.exit(123);');

    let error = false;
    try {
      await runYarn([], {cwd});
    } catch (err) {
      error = err.code;
    }

    expect(error).toEqual(123);
  });

  test('sh file exit code', async () => {
    const cwd = await makeTemp();

    if (process.platform !== 'win32') {
      await fs.writeFile(`${cwd}/.yarnrc`, 'yarn-path "./override.sh"\n');
      await fs.writeFile(`${cwd}/override.sh`, '#!/usr/bin/env sh\n\nexit 123\n');

      await fs.chmod(`${cwd}/override.sh`, 0o755);
    } else {
      await fs.writeFile(`${cwd}/.yarnrc`, 'yarn-path "./override.cmd"\r\n');
      await fs.writeFile(`${cwd}/override.cmd`, 'exit /b 123\r\n');
    }

    let error = false;
    try {
      await runYarn([], {cwd});
    } catch (err) {
      error = err.code;
    }

    expect(error).toEqual(123);
  });
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

  const trickyStrings = ['$PWD', '%CD%', '^', '!', '\\', '>', '<', '|', '&', "'", '"', '`', '  ', '(', ')'];
  const [stdout] = await runYarn(['stringify', ...trickyStrings], options);

  expect(stdout.toString().trim()).toEqual(JSON.stringify(trickyStrings));
});

test('yarn run <failing script>', async () => {
  const cwd = await makeTemp();

  await fs.writeFile(
    path.join(cwd, 'package.json'),
    JSON.stringify({
      license: 'MIT',
      scripts: {false: 'exit 1'},
    }),
  );

  let stderr = null;
  let err = null;
  try {
    await runYarn(['run', 'false'], {cwd});
  } catch (e) {
    stderr = e.stderr.trim();
    err = e.code;
  }

  expect(err).toEqual(1);
  expect(stderr).toEqual('error Command failed with exit code 1.');
});

test('yarn run in path need escaping', async () => {
  const cwd = await makeTemp('special (chars)');

  await fs.writeFile(path.join(cwd, 'package.json'), '{}');
  const binDir = path.join(cwd, 'node_modules', '.bin');
  await fs.mkdirp(binDir);
  const executablePath = path.join(binDir, 'yolo');
  await fs.writeFile(executablePath, 'echo yolo');
  await fs.chmod(executablePath, 0o755);
  // For Windows
  await fs.writeFile(`${executablePath}.cmd`, '@ECHO off\necho yolo');

  const options = {cwd, env: {YARN_SILENT: 1}};

  const [stdout] = await runYarn(['yolo'], options);

  expect(stdout.toString().trim()).toEqual('yolo');
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

test('relative cache folder', async () => {
  const base = await makeTemp();

  await fs.writeFile(`${base}/.yarnrc`, 'cache-folder "./foo"\n');

  await fs.mkdirp(`${base}/sub`);
  await fs.mkdirp(`${base}/foo`);

  const [stdoutOutput, _] = await runYarn(['cache', 'dir'], {cwd: `${base}/sub`});

  // The dirname is to remove the "v2" part
  expect(await fs.realpath(path.dirname(stdoutOutput.toString()))).toEqual(await fs.realpath(`${base}/foo`));
});

test('yarn create', async () => {
  const cwd = await makeTemp();
  const options = {cwd, env: {YARN_SILENT: 1}};

  const [stdoutOutput, _] = await runYarn(['create', 'html'], options);

  expect(stdoutOutput.toString()).toMatch(/<!doctype html>/);
});

test('yarn init -y', async () => {
  const cwd = await makeTemp();
  const innerDir = path.join(cwd, 'inner');
  const initialManifestFile = JSON.stringify({name: 'test', license: 'ISC', version: '1.0.0'});

  await fs.writeFile(`${cwd}/package.json`, initialManifestFile);
  await fs.mkdirp(innerDir);

  const options = {cwd: innerDir};
  await runYarn(['init', '-y'], options);

  expect(await fs.exists(path.join(innerDir, 'package.json'))).toEqual(true);

  const manifestFile = await fs.readFile(path.join(cwd, 'package.json'));
  expect(manifestFile).toEqual(initialManifestFile);
});
