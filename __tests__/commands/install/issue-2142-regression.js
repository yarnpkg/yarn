/* @flow */
import {runInstall} from '../_helpers.js';
import * as fs from '../../../src/util/fs.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const request = require('request');
const assert = require('assert');
const path = require('path');

beforeEach(request.__resetAuthedRequests);
// $FlowFixMe
afterEach(request.__resetAuthedRequests);

// problem occuring due to optional dependency incompatible with os, in this case fsevents
// if issue exists, this will not fail on OSX
test.concurrent('issue #2142 regression test',
  (): Promise<void> => {
    return runInstall({production: true}, 'install-issue-2142-regression', async (config) => {
      assert.ok(await fs.exists(path.join(config.cwd, 'node_modules', 'deep-extend')));
      assert.ok(await fs.exists(path.join(config.cwd, 'node_modules', 'ini')));
      assert.ok(await fs.exists(path.join(config.cwd, 'node_modules', 'strip-json-comments')));
    });
  });

