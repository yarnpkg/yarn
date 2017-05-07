/* @flow */

import * as fs from '../../../src/util/fs.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

const request = require('request');
const path = require('path');
import {runInstall} from '../_helpers.js';

async function getLinkedPath(path): Promise<string> {
  const stat = await fs.lstat(path);
  if (stat.isSymbolicLink()) {
    const linkPath = await fs.readlink(path);
    return linkPath;
  } else {
    const contents = await fs.readFile(path);
    return /node" +"\$basedir\/([^"]*\.js)"/.exec(contents)[1];
  }
}

beforeEach(request.__resetAuthedRequests);
afterEach(request.__resetAuthedRequests);

test('install should hoist nested bin scripts', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-nested-bin', async (config) => {
    const binScripts = await fs.walk(path.join(config.cwd, 'node_modules', '.bin'));
    // need to double the amount as windows makes 2 entries for each dependency
    // so for below, there would be an entry for eslint and eslint.cmd on win32
    const amount = process.platform === 'win32' ? 20 : 10;
    expect(binScripts).toHaveLength(amount);
    expect(binScripts.findIndex((f) => f.basename === 'standard')).toBeGreaterThanOrEqual(0);
    expect(binScripts.findIndex((f) => f.basename === 'eslint')).toBeGreaterThanOrEqual(0);

    let idx = binScripts.findIndex((f) => f.basename === 'standard');
    let linkPath = await getLinkedPath(binScripts[idx].absolute);
    expect(linkPath).toEqual('../standard/bin/cmd.js');

    idx = binScripts.findIndex((f) => f.basename === 'eslint');
    linkPath = await getLinkedPath(binScripts[idx].absolute);
    expect(linkPath).toEqual('../eslint/bin/eslint.js');
  });
});

// dependency tree:
//   eslint@3.7.0
//   standard
//   standard -> eslint@3.7.1
// result should be:
//   eslint 3.7.0 is linked in /.bin because it takes priority over the transitive 3.7.1
//   eslint 3.7.1 is linked in standard/node_modules/.bin
test('direct dependency bin takes priority over transitive bin', (): Promise<void> => {
  return runInstall({binLinks: true}, 'install-duplicate-bin', async (config) => {
    const binScripts = await fs.walk(path.join(config.cwd, 'node_modules', '.bin'));
    const idx = binScripts.findIndex((f) => f.basename === 'eslint');
    const linkPath = await getLinkedPath(binScripts[idx].absolute);
    expect(linkPath).toEqual('../eslint/bin/eslint.js');
  });
});

test.concurrent('install should respect --no-bin-links flag', (): Promise<void> => {
  return runInstall({binLinks: false}, 'install-nested-bin', async (config) => {
    const binExists = await fs.exists(path.join(config.cwd, 'node_modules', '.bin'));
    expect(binExists).toBeFalsy();
  });
});
