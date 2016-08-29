/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */

import * as child from '../../src/util/child.js';
import Config from '../../src/config.js';
import {SELF_UPDATE_DOWNLOAD_FOLDER} from '../../src/constants.js';
import * as fs from '../../src/util/fs.js';
import {run as selfUpdate} from '../../src/cli/commands/self-update.js';
import * as reporters from '../../src/reporters/index.js';

const path = require('path');
const stream = require('stream');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
const updatesFolder = path.resolve(__dirname, '..', '..', SELF_UPDATE_DOWNLOAD_FOLDER);
const updateTempFolder = path.resolve(__dirname, '..', '..', 'updates_temp');

declare function beforeAll(fn: Function): void;
declare function afterAll(fn: Function): void;

beforeAll(async (done) => {
  if (await fs.exists(updatesFolder)) {
    await fs.rename(updatesFolder, updateTempFolder);
  }
  done();
});

afterAll(async (done) => {
  if (await fs.exists(updateTempFolder)) {
    await fs.rename(updateTempFolder, updatesFolder);
  }
  done();
});

async function run(checks: (reporter: reporters.Reporter, config: Config) => Promise<void>) {
  let out = '';
  let stdout = new stream.Writable({
    decodeStrings: false,
    write(data, encoding, cb) {
      out += data;
      cb();
    },
  });
  try {
    const reporter = new reporters.ConsoleReporter({stdout, stderr: stdout});
    const cwd = path.resolve(updatesFolder, '..');
    const config = new Config(reporter, {cwd});
    await checks(reporter, config);
  } catch (err) {
    throw new Error(`${err} \nConsole output:\n ${out}`);
  } finally {
    await fs.unlink(updatesFolder);
  }
}

test('Self-update should download a release and symlink it as "current"', async (): Promise<void> => {
  return run(async (reporter, config) => {
    await selfUpdate(config, reporter, {}, ['v0.11.0']);
    expect(await fs.exists(path.resolve(updatesFolder, 'current')));
    expect(await fs.exists(path.resolve(updatesFolder, 'v0.11.0')));
    const packageJson = await fs.readJson(path.resolve(updatesFolder, 'current', 'package.json'));
    expect(packageJson.version === '0.11.0');
    const version = await child.exec('node bin/kpm.js -V');
    expect(version[0].trim(), `0.11.0`);
  });
});


test('Self-update should work from self-updated location', async (): Promise<void> => {
  return run(async (reporter, config) => {
    // mock an existing self-update
    await child.exec('make build');
    await fs.copy(path.resolve(updatesFolder, '..'), path.resolve(updatesFolder, 'v0.99.0'));
    await fs.symlink(path.resolve(updatesFolder, 'v0.99.0'), path.resolve(updatesFolder, 'current'));
    let packageJson = await fs.readJson(path.resolve(updatesFolder, 'current', 'package.json'));
    packageJson.version = '0.99.0';
    await fs.writeFile(path.resolve(updatesFolder, 'current', 'package.json'),
      JSON.stringify(packageJson, null, 4));
    let version = await child.exec('node bin/kpm.js -V');
    expect(version[0].trim(), `0.99.0`);

    // mock a to_clean folder
    packageJson.version = '0.98.0';
    fs.mkdirp(path.resolve(updatesFolder, 'v0.98.0'));
    await fs.symlink(path.resolve(updatesFolder, 'v0.98.0'), path.resolve(updatesFolder, 'to_clean'));
    await fs.writeFile(path.resolve(updatesFolder, 'v0.98.0', 'package.json'),
      JSON.stringify(packageJson, null, 4));

    await child.exec('node bin/kpm.js self-update v0.11.0');

    // new version is current
    version = await child.exec('node bin/kpm.js -V');
    expect(version[0].trim(), `0.11.0`);

    expect(await fs.exists(path.resolve(updatesFolder, 'v0.98.0'))).toBe(false);
    expect(await fs.exists(path.resolve(updatesFolder, 'v0.99.0'))).toBe(true);
    expect(await fs.exists(path.resolve(updatesFolder, 'v0.11.0'))).toBe(true);

    packageJson = await fs.readJson(path.resolve(updatesFolder, 'to_clean', 'package.json'));
    expect(packageJson.version).toBe('0.99.0');
  });
});
