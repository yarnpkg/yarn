/* @flow */
/* eslint max-len: 0 */

import {NoopReporter} from '../../src/reporters/index.js';
import Config from '../../src/config.js';
import type {ConfigOptions} from '../../src/config.js';
import * as fs from '../../src/util/fs.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

const https = require('https');
const path = require('path');

async function createConfig(opts: ConfigOptions = {}): Promise<Config> {
  const config = new Config(new NoopReporter());
  await config.init(opts);
  return config;
}

test('RequestManager.request with cafile', async () => {
  let body;
  const options = {
    key: await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'server-key.pem')),
    cert: await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'server-cert.pem')),
  };
  const server = https.createServer(options, (req, res) => { res.end('ok'); });
  try {
    server.listen(0);
    const config = await createConfig({'cafile': path.join(__dirname, '..', 'fixtures', 'certificates', 'cacerts.pem')});
    const port = server.address().port;
    body = await config.requestManager.request({url: `https://localhost:${port}/?nocache`, headers: {Connection: 'close'}});
  } finally {
    server.close();
  }
  expect(body).toBe('ok');
});
