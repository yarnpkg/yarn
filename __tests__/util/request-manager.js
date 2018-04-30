/* @flow */
/* eslint max-len: 0 */

import {Reporter} from '../../src/reporters/index.js';
import Config from '../../src/config.js';
import * as fs from '../../src/util/fs.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

const net = require('net');
const https = require('https');
const http = require('http');
const path = require('path');

test('RequestManager.request with cafile', async () => {
  let body;
  const options = {
    key: await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'server-key.pem')),
    cert: await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'server-cert.pem')),
  };
  const server = https.createServer(options, (req, res) => {
    res.end('ok');
  });
  try {
    server.listen(0);
    const config = await Config.create({
      cafile: path.join(__dirname, '..', 'fixtures', 'certificates', 'cacerts.pem'),
    });
    const port = server.address().port;
    body = await config.requestManager.request({
      url: `https://localhost:${port}/?nocache`,
      headers: {Connection: 'close'},
    });
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
  const server = https.createServer(options, (req, res) => {
    res.end('ok');
  });
  try {
    server.listen(0);
    const bundle = await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'cacerts.pem'));
    const hasPemPrefix = block => block.startsWith('-----BEGIN ');
    const caCerts = bundle.split(/(-----BEGIN .*\r?\n[^-]+\r?\n--.*)/).filter(hasPemPrefix);
    // the 2nd cert is valid one
    const config = await Config.create({ca: caCerts[1]});
    const port = server.address().port;
    body = await config.requestManager.request({
      url: `https://localhost:${port}/?nocache`,
      headers: {Connection: 'close'},
    });
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
  const server = https.createServer(options, (req, res) => {
    res.end('ok');
  });
  try {
    server.listen(0);
    const bundle = await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'cacerts.pem'));
    const hasPemPrefix = block => block.startsWith('-----BEGIN ');
    const caCerts = bundle.split(/(-----BEGIN .*\r?\n[^-]+\r?\n--.*)/).filter(hasPemPrefix);
    const config = await Config.create({ca: caCerts});
    const port = server.address().port;
    body = await config.requestManager.request({
      url: `https://localhost:${port}/?nocache`,
      headers: {Connection: 'close'},
    });
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
  const server = https.createServer(options, (req, res) => {
    res.end('ok');
  });
  try {
    server.listen(0);
    const config = await Config.create({
      cafile: path.join(__dirname, '..', 'fixtures', 'certificates', 'server-ca-cert.pem'),
      key: await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'client-key.pem')),
      cert: await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'client-cert.pem')),
    });
    const port = server.address().port;
    body = await config.requestManager.request({
      url: `https://localhost:${port}/?nocache`,
      headers: {Connection: 'close'},
    });
  } finally {
    server.close();
  }
  expect(body).toBe('ok');
});

const setupServer = async () => {
  const options = {
    key: await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'server-key.pem')),
    cert: await fs.readFile(path.join(__dirname, '..', 'fixtures', 'certificates', 'server-cert.pem')),
  };
  const httpsServer = https.createServer(options, (req, res) => {
    res.end('ok');
  });
  const httpServer = http.createServer((req, res) => {
    res.end('ok');
  });

  httpsServer.listen(0);
  httpServer.listen(0);

  const httpsPort = httpsServer.address().port;
  const httpPort = httpServer.address().port;

  return {
    caFilePath: path.join(__dirname, '..', 'fixtures', 'certificates', 'cacerts.pem'),
    httpPort,
    httpUrl: `http://localhost:${httpPort}/?nocache`,
    httpsPort,
    httpsUrl: `https://localhost:${httpsPort}/?nocache`,
    close: () => {
      httpsServer.close();
      httpServer.close();
    },
  };
};

const setProxyEnvVars = () => {
  process.env.HTTP_PROXY = 'http://example-proxy.com';
  process.env.HTTPS_PROXY = 'http://example-proxy.com';
  delete process.env.NO_PROXY;
};

const deleteProxyEnvVars = () => {
  delete process.env.HTTP_PROXY;
  delete process.env.HTTPS_PROXY;
  delete process.env.NO_PROXY;
};

test('RequestManager.request with env vars proxy options and only no-proxy option in config', async () => {
  const server = await setupServer();

  try {
    setProxyEnvVars();

    const configWithProxyExclusion = await Config.create({
      cafile: server.caFilePath,
      noProxy: 'localhost',
    });

    let successfulRequestBody = await configWithProxyExclusion.requestManager.request({
      url: server.httpsUrl,
      headers: {Connection: 'close'},
    });
    expect(successfulRequestBody).toBe('ok');

    successfulRequestBody = await configWithProxyExclusion.requestManager.request({
      url: server.httpUrl,
      headers: {Connection: 'close'},
    });
    expect(successfulRequestBody).toBe('ok');
  } finally {
    deleteProxyEnvVars();
    server.close();
  }
});

const testProxyOptionsInConfigFile = async () => {
  const server = await setupServer();

  try {
    const configWithProxyExclusion = await Config.create({
      cafile: server.caFilePath,
      noProxy: 'localhost',
      httpProxy: 'http://example-proxy.com',
      httpsProxy: 'http://example-proxy.com',
    });

    let successfulRequestBody = await configWithProxyExclusion.requestManager.request({
      url: server.httpsUrl,
      headers: {Connection: 'close'},
    });
    expect(successfulRequestBody).toBe('ok');

    successfulRequestBody = await configWithProxyExclusion.requestManager.request({
      url: server.httpUrl,
      headers: {Connection: 'close'},
    });
    expect(successfulRequestBody).toBe('ok');
  } finally {
    server.close();
  }
};

test('RequestManager.request with proxy and no-proxy options only in config without env vars', async () => {
  deleteProxyEnvVars();
  await testProxyOptionsInConfigFile();
});

test('RequestManager.request with both proxy options in env vars and config and no-proxy options in config', async () => {
  try {
    setProxyEnvVars();
    await testProxyOptionsInConfigFile();
  } finally {
    deleteProxyEnvVars();
  }
});

test('RequestManager.execute timeout error with maxRetryAttempts=1', async () => {
  jest.useFakeTimers();

  const LIMIT = 1;
  let counter = 0;
  const server = net.createServer(c => {
    counter += 1;

    // Trigger our offline retry queue which has a fixed 3 sec delay
    if (counter < LIMIT) {
      c.on('close', jest.runOnlyPendingTimers.bind(jest));
    }

    // emulate TCP server that never closes the connection by not
    // doing anything
  });

  try {
    server.listen(0);
    const config = await Config.create({networkTimeout: 50});
    config.requestManager.setOptions({maxRetryAttempts: LIMIT});
    const port = server.address().port;
    await config.requestManager.request({
      url: `http://localhost:${port}/?nocache`,
    });
  } catch (err) {
    expect(err.message).toContain('TIMEDOUT');
    expect(counter).toEqual(LIMIT);
  } finally {
    await server.close();
    jest.useRealTimers();
  }
});

test('RequestManager.execute timeout error with default maxRetryAttempts', async () => {
  jest.useFakeTimers();

  const LIMIT = 5;
  let counter = 0;
  const server = net.createServer(c => {
    counter += 1;

    // Trigger our offline retry queue which has a fixed 3 sec delay
    if (counter < LIMIT) {
      c.on('close', jest.runOnlyPendingTimers.bind(jest));
    }

    // emulate TCP server that never closes the connection by not
    // doing anything
  });

  try {
    server.listen(0);
    const config = await Config.create({networkTimeout: 50});
    const port = server.address().port;
    await config.requestManager.request({
      url: `http://localhost:${port}/?nocache`,
    });
  } catch (err) {
    expect(err.message).toContain('TIMEDOUT');
    expect(counter).toEqual(LIMIT);
  } finally {
    await server.close();
    jest.useRealTimers();
  }
});

test('RequestManager.execute Request 403 error', async () => {
  const config = await Config.create({}, new Reporter());
  jest.mock('request', factory => options => {
    options.callback('', {statusCode: 403}, '');
    return {
      on: () => {},
    };
  });
  await config.requestManager.execute({
    params: {
      url: `https://localhost:80/?nocache`,
      headers: {Connection: 'close'},
    },
    resolve: body => {},
    reject: err => {
      expect(err.message).toBe('https://localhost:80/?nocache: Request "https://localhost:80/?nocache" returned a 403');
    },
  });
});

test('RequestManager.request with offlineNoRequests', async () => {
  const config = await Config.create({offline: true}, new Reporter());
  try {
    await config.requestManager.request({
      url: `https://localhost:80/?nocache`,
      headers: {Connection: 'close'},
    });
  } catch (err) {
    expect(err.message).toBe('Can\'t make a request in offline mode ("https://localhost:80/?nocache")');
  }
});

test('RequestManager.saveHar no captureHar error message', async () => {
  const config = await Config.create({captureHar: false}, new Reporter());
  try {
    config.requestManager.saveHar('testFile');
  } catch (err) {
    expect(err.message).toBe('RequestManager was not setup to capture HAR files');
  }
});
