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

test('RequestManager.request with ca (string)', async () => {
  let body;
  const options = {
    key: await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'server-key.pem')),
    cert: await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'server-cert.pem')),
  };
  const server = https.createServer(options, (req, res) => { res.end('ok'); });
  try {
    server.listen(0);
    const bundle = await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'cacerts.pem'));
    const hasPemPrefix = (block) => block.startsWith('-----BEGIN ');
    const caCerts = bundle.split(/(-----BEGIN .*\r?\n[^-]+\r?\n--.*)/).filter(hasPemPrefix);
    // the 2nd cert is valid one
    const config = await createConfig({'ca': caCerts[1]});
    const port = server.address().port;
    body = await config.requestManager.request({url: `https://localhost:${port}/?nocache`, headers: {Connection: 'close'}});
  } finally {
    server.close();
  }
  expect(body).toBe('ok');
});

test('RequestManager.request with ca (array)', async () => {
  let body;
  const options = {
    key: await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'server-key.pem')),
    cert: await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'server-cert.pem')),
  };
  const server = https.createServer(options, (req, res) => { res.end('ok'); });
  try {
    server.listen(0);
    const bundle = await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'cacerts.pem'));
    const hasPemPrefix = (block) => block.startsWith('-----BEGIN ');
    const caCerts = bundle.split(/(-----BEGIN .*\r?\n[^-]+\r?\n--.*)/).filter(hasPemPrefix);
    const config = await createConfig({'ca': caCerts});
    const port = server.address().port;
    body = await config.requestManager.request({url: `https://localhost:${port}/?nocache`, headers: {Connection: 'close'}});
  } finally {
    server.close();
  }
  expect(body).toBe('ok');
});

test('RequestManager.request with mutual TLS', async () => {
  let body;
  const options = {
    key: await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'server-key.pem')),
    cert: await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'server-cert.pem')),
    ca: await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'server-ca-cert.pem')),
    requestCert: true,
    rejectUnauthorized: true,
  };
  const server = https.createServer(options, (req, res) => { res.end('ok'); });
  try {
    server.listen(0);
    const config = await createConfig({
      'cafile': path.join(__dirname, '..', 'fixtures', 'certificates', 'server-ca-cert.pem'),
      'key': await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'client-key.pem')),
      'cert': await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'client-cert.pem')),
    });
    const port = server.address().port;
    body = await config.requestManager.request({url: `https://localhost:${port}/?nocache`, headers: {Connection: 'close'}});
  } finally {
    server.close();
  }
  expect(body).toBe('ok');
});

test('RequestManager.execute Request 403 error', async () => {
  const config = await createConfig({});
  jest.mock('request', (factory) => (options) => {
    options.callback('', {statusCode: 403}, '');
    return {
      on: () => {},
    };
  });
  await config.requestManager.execute({
    params: {url: `https://localhost:port/?nocache`, headers: {Connection: 'close'}},
    resolve: (body) => {},
    reject: (err) => {
      expect(err.message).toBe('https://localhost:port/?nocache: Request "https://localhost:port/?nocache" returned a 403');
    },
  });
});

test('RequestManager.request with offlineNoRequests', async () => {
  const config = await createConfig({offline: true});
  try {
    await config.requestManager.request({url: `https://localhost:port/?nocache`, headers: {Connection: 'close'}});
  } catch (err) {
    expect(err.message).toBe('Can\'t make a request in offline mode');
  }
});

test('RequestManager.saveHar no captureHar error message', async () => {
  const config = await createConfig({captureHar: false});
  try {
    config.requestManager.saveHar('testFile');
  } catch (err) {
    expect(err.message).toBe('RequestManager was not setup to capture HAR files');
  }
});
