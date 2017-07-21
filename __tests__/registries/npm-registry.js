/* @flow */

import NpmRegistry from '../../src/registries/npm-registry.js';
import {resolve} from 'path';
import homeDir from '../../src/util/user-home-dir.js';

describe('normalizeConfig', () => {
  beforeAll(() => {
    process.env.REPLACE = 'REPLACED';
  });

  afterAll(() => {
    delete process.env.REPLACE;
  });

  test('environment is replaced', () => {
    const normalized = NpmRegistry.normalizeConfig({username: '[${REPLACE}]'})['username'];
    expect(normalized).toEqual('[REPLACED]');
  });

  test("path normalization doesn't affect all options", () => {
    const normalized = NpmRegistry.normalizeConfig({username: 'foo'})['username'];
    expect(normalized).toEqual('foo');
  });

  test('resolve path to current directory', () => {
    const normalized = NpmRegistry.normalizeConfig({cafile: 'foo'})['cafile'];
    expect(normalized).toEqual(resolve(process.cwd(), 'foo'));
  });

  test('resolve path to home directory', () => {
    const normalized = NpmRegistry.normalizeConfig({cafile: '~/foo'})['cafile'];
    expect(normalized).toEqual(resolve(homeDir, 'foo'));
  });

  test('resolve keep path to rooted directory', () => {
    const rooted = process.platform === 'win32' ? 'C:\\foo' : '/foo';
    const normalized = NpmRegistry.normalizeConfig({cafile: rooted})['cafile'];
    expect(normalized).toEqual(rooted);
  });
});

describe('request', () => {
  function createMocks(): Object {
    const mockRequestManager = {
      request: jest.fn(),
    };
    const mockRegistries = {
      npm: jest.fn(),
      yarn: {
        getScopedOption: jest.fn(),
      },
    };
    const mockReporter = jest.fn();

    return {
      mockRequestManager,
      mockRegistries,
      mockReporter,
    };
  }

  test('should call requestManager.request with pathname url', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    const pathname = 'http://github.com/yarnpkg/yarn.tgz';

    npmRegistry.request(pathname);

    const requestParams = mockRequestManager.request.mock.calls[0][0];

    expect(requestParams.url).toBe(pathname);
  });

  test('should not add authorization header if pathname not to registry', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    const pathname = 'http://github.com/yarnpkg/yarn.tgz';

    npmRegistry.request(pathname);

    const requestParams = mockRequestManager.request.mock.calls[0][0];

    expect(requestParams.headers.authorization).toBe(undefined);
  });

  test('should not add authorization header if pathname is to registry and always-auth is false', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    const pathname = 'https://registry.npmjs.org/yarnpkg/yarn.tgz';

    npmRegistry.config = {
      'always-auth': false,
      _authToken: 'testAuthToken',
    };
    npmRegistry.request(pathname);

    const requestParams = mockRequestManager.request.mock.calls[0][0];

    expect(requestParams.headers.authorization).toBe(undefined);
  });

  test('should not add authorization header if pathname is to registry and not scopped package', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    const pathname = 'https://registry.npmjs.org/yarnpkg/yarn.tgz';

    npmRegistry.config = {
      _authToken: 'testAuthToken',
    };
    npmRegistry.request(pathname);

    const requestParams = mockRequestManager.request.mock.calls[0][0];

    expect(requestParams.headers.authorization).toBe(undefined);
  });

  test('should add authorization header if pathname is to registry and always-auth is true', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    const pathname = 'https://registry.npmjs.org/yarnpkg/yarn.tgz';

    npmRegistry.config = {
      'always-auth': true,
      _authToken: 'testAuthToken',
    };
    npmRegistry.request(pathname);

    const requestParams = mockRequestManager.request.mock.calls[0][0];

    expect(requestParams.headers.authorization).toBe('Bearer testAuthToken');
  });

  test('should add authorization header if pathname is to registry and is scopped package', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    const pathname = 'https://registry.npmjs.org/@testScope/yarn.tgz';

    npmRegistry.config = {
      _authToken: 'testAuthToken',
    };
    npmRegistry.request(pathname);

    const requestParams = mockRequestManager.request.mock.calls[0][0];

    expect(requestParams.headers.authorization).toBe('Bearer testAuthToken');
  });
});
