/* @flow */

import * as fs from '../../../src/util/fs.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

const request = require('request');
const path = require('path');
import {runInstall} from '../_helpers.js';

beforeEach(request.__resetAuthedRequests);
afterEach(request.__resetAuthedRequests);

async function findHarFile(dir): Promise<string> {
  const filenames = await fs.readdir(dir);
  for (const file of filenames) {
    if (file.endsWith('.har')) {
      return path.join(dir, file);
    }
  }
  throw new Error('could not find a .har file');
}

test('--har flag produces a har file with registry requests', () =>
  runInstall({har: true}, 'install-production', async config => {
    const harFile = await findHarFile(config.cwd);
    const contents = await fs.readJson(harFile);
    expect(contents.log.entries).toHaveLength(2);
    const urls = contents.log.entries.map(e => e.request.url).sort();
    expect(urls[0]).toContain('is-array');
    expect(urls[1]).toContain('left-pad');
  }));
