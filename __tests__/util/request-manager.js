/* @flow */
/* eslint max-len: 0 */

import {OneTimePasswordError} from '../../src/errors.js';
import {Reporter} from '../../src/reporters/index.js';
import Config from '../../src/config.js';
import * as fs from '../../src/util/fs.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

const net = require('net');
const http = require('http');
const https = require('https');
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
  const server = http.createServer(req => {
    counter += 1;
    // Trigger our offline retry queue which has a fixed 3 sec delay
    if (counter < LIMIT) {
      req.on('aborted', jest.runOnlyPendingTimers.bind(jest));
    }
    // emulate HTTP server that never closes the connection by not
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

for (const statusCode of [403, 442]) {
  test(`RequestManager.execute Request ${statusCode} error`, async () => {
    // The await await is just to silence Flow - https://github.com/facebook/flow/issues/6064
    const config = await await Config.create({}, new Reporter());
    const mockStatusCode = statusCode;
    jest.mock('request', factory => options => {
      options.callback('', {statusCode: mockStatusCode}, '');
      return {
        on: () => {},
      };
    });
    await config.requestManager.execute({
      params: {
        url: `https://localhost:port/?nocache`,
        headers: {Connection: 'close'},
      },
      resolve: body => {},
      reject: err => {
        expect(err.message).toBe(
          `https://localhost:port/?nocache: Request "https://localhost:port/?nocache" returned a 403`,
        );
      },
    });
  });
}

test('RequestManager.execute one time password error on npm request', async () => {
  jest.resetModules();
  jest.mock('request', factory => options => {
    options.callback(
      '',
      {statusCode: 401, headers: {'www-authenticate': 'otp'}},
      {error: 'You must provide a one-time pass. Upgrade your client to npm@latest in order to use 2FA.'},
    );
    return {
      on: () => {},
    };
  });

  try {
    const config = await Config.create({});
    await config.requestManager.request({
      url: 'https://registry.npmjs.org/yarn',
    });
  } catch (err) {
    expect(err).toBeInstanceOf(OneTimePasswordError);
  }
});

test('RequestManager.execute one time password error on npm login request', async () => {
  jest.resetModules();
  jest.mock('request', factory => options => {
    options.callback('', {statusCode: 401, headers: {'www-authenticate': 'otp'}}, {ok: false});
    return {
      on: () => {},
    };
  });

  try {
    const config = await Config.create({});
    await config.requestManager.request({
      url: 'https://registry.npmjs.org/-/user/org.couchdb.user:user',
    });
  } catch (err) {
    expect(err).toBeInstanceOf(OneTimePasswordError);
  }
});

// Cloudflare will occasionally return an html response with a 500 status code on some calls
for (const statusCode of [408, 500, 542]) {
  test(`RequestManager.execute retries on ${statusCode} error`, async () => {
    jest.resetModules();
    // The await await is just to silence Flow - https://github.com/facebook/flow/issues/6064
    const config = await await Config.create({}, new Reporter());
    const mockStatusCode = statusCode;
    jest.mock('request', factory => {
      let retryCount = 2;
      return options => {
        if (retryCount-- > 0) {
          options.callback(
            '',
            {statusCode: mockStatusCode},
            `<!DOCTYPE html><title>Rendering error | registry.yarnpkg.com | Cloudflare</title>...`,
          );
        } else {
          options.callback('', {statusCode: 200}, '');
        }
        return {
          on: () => {},
        };
      };
    });
    await config.requestManager.execute({
      params: {
        url: `https://localhost:port/?nocache`,
        headers: {Connection: 'close'},
      },
      resolve: body => {
        expect(body).not.toEqual(false);
      },
    });
  });
}

test('RequestManager.request with offlineNoRequests', async () => {
  const config = await Config.create({offline: true}, new Reporter());
  try {
    await config.requestManager.request({
      url: `https://localhost:port/?nocache`,
      headers: {Connection: 'close'},
    });
  } catch (err) {
    expect(err.message).toBe('Can\'t make a request in offline mode ("https://localhost:port/?nocache")');
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
