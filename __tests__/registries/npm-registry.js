/* @flow */

import {resolve, join as pathJoin} from 'path';

import NpmRegistry from '../../src/registries/npm-registry.js';
import {BufferReporter} from '../../src/reporters/index.js';
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

  return {
    mockRequestManager,
    mockRegistries,
  };
}

describe('request', () => {
  test('should call requestManager.request with url', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    const url = 'https://github.com/yarnpkg/yarn.tgz';

    npmRegistry.request(url);

    const requestParams = mockRequestManager.request.mock.calls[0][0];

    expect(requestParams.url).toBe(url);
  });

  test('should not add authorization header if pathname not to registry', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    const url = 'https://github.com/yarnpkg/yarn.tgz';

    npmRegistry.request(url);

    const requestParams = mockRequestManager.request.mock.calls[0][0];

    expect(requestParams.headers.authorization).toBeUndefined();
  });

  test('should not add authorization header if pathname not to registry and always-auth is true', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    const url = 'https://github.com/yarnpkg/yarn.tgz';

    npmRegistry.config = {
      'always-auth': true,
      _authToken: 'testAuthToken',
    };
    npmRegistry.request(url);

    const requestParams = mockRequestManager.request.mock.calls[0][0];

    expect(requestParams.headers.authorization).toBeUndefined();
  });

  test('should not add authorization header if pathname is to registry and always-auth is false', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    const url = 'https://registry.npmjs.org/yarnpkg/yarn.tgz';

    npmRegistry.config = {
      // Default is: 'always-auth': false,
      _authToken: 'testAuthToken',
    };
    npmRegistry.request(url);

    const requestParams = mockRequestManager.request.mock.calls[0][0];

    expect(requestParams.headers.authorization).toBeUndefined();
  });

  test('should not add authorization header if pathname is to registry and not scopped package', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    const url = 'https://registry.npmjs.org/yarnpkg/yarn.tgz';

    npmRegistry.config = {
      _authToken: 'testAuthToken',
    };
    npmRegistry.request(url);

    const requestParams = mockRequestManager.request.mock.calls[0][0];

    expect(requestParams.headers.authorization).toBeUndefined();
  });

  test('should add authorization header if pathname is to registry and always-auth is true', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    const url = 'https://registry.npmjs.org/yarnpkg/yarn.tgz';

    npmRegistry.config = {
      'always-auth': true,
      _authToken: 'testAuthToken',
    };
    npmRegistry.request(url);

    const requestParams = mockRequestManager.request.mock.calls[0][0];

    expect(requestParams.headers.authorization).toBe('Bearer testAuthToken');
  });

  test('should add authorization header if pathname is to registry and is scopped package', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    const url = 'https://registry.npmjs.org/@testScope%2fyarn.tgz';

    npmRegistry.config = {
      _authToken: 'testAuthToken',
    };
    npmRegistry.request(url);

    const requestParams = mockRequestManager.request.mock.calls[0][0];

    expect(requestParams.headers.authorization).toBe('Bearer testAuthToken');
  });

  test('should add authorization header with token for custom registries with a scoped package', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    const url = 'https://some.other.registry/@testScope%2fyarn.tgz';

    npmRegistry.config = {
      '//some.other.registry/:_authToken': 'testScopedAuthToken',
      '@testScope:registry': '//some.other.registry/',
    };
    npmRegistry.request(url);

    const requestParams = mockRequestManager.request.mock.calls[0][0];

    expect(requestParams.headers.authorization).toBe('Bearer testScopedAuthToken');
  });
});

describe('isRequestToRegistry functional test', () => {
  test('request to registry url matching', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    const validRegistryUrls = [
      ['http://foo.bar:80/foo/bar/baz', 'http://foo.bar/foo/'],
      ['http://foo.bar:80/foo/bar/baz', 'https://foo.bar/foo/'],
      ['http://foo.bar/foo/bar/baz', 'http://foo.bar/foo/'],
      ['http://foo.bar/foo/00000000-1111-4444-8888-000000000000/baz', 'http://foo.bar/foo/'],
      ['https://foo.bar:443/foo/bar/baz', 'https://foo.bar/foo/'],
      ['http://foo.bar/foo/bar/baz', 'https://foo.bar:443/foo/'],
      ['https://foo.bar/foo/bar/baz', 'https://foo.bar:443/foo/'],
      ['HTTP://xn--xample-hva.com:80/foo/bar/baz', 'http://êxample.com/foo/bar/baz'],
    ];

    const invalidRegistryUrls = [
      ['https://wrong.thing/foo/bar/baz', 'https://foo.bar/foo/'],
      ['https://foo.bar:1337/foo/bar/baz', 'https://foo.bar/foo/'],
    ];

    validRegistryUrls.forEach(([requestUrl, registryUrl]) =>
      expect(npmRegistry.isRequestToRegistry(requestUrl, registryUrl)).toBe(true),
    );
    invalidRegistryUrls.forEach(([requestUrl, registryUrl]) =>
      expect(npmRegistry.isRequestToRegistry(requestUrl, registryUrl)).toBe(false),
    );
  });

  test('isRequestToRegistry with custom host prefix', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    npmRegistry.config = {
      'custom-host-suffix': 'some.host.org',
    };

    expect(npmRegistry.isRequestToRegistry('http://pkgs.host.com:80/foo/bar/baz', 'http://pkgs.host.com/bar/baz')).toBe(
      false,
    );

    npmRegistry.config = {
      'custom-host-suffix': 'pkgs.host.com',
    };

    expect(npmRegistry.isRequestToRegistry('http://pkgs.host.com:80/foo/bar/baz', 'http://pkgs.host.com/bar/baz')).toBe(
      true,
    );
  });
});

const packageIdents = [
  ['normal', ''],
  ['@scopedNoPkg', ''],
  ['@scoped/notescaped', ''],
  ['not@scope/pkg', ''],
  ['@scope?query=true', ''],
  ['@scope%2fpkg', '@scope'],
  ['@scope%2fpkg%2fext', '@scope'],
  ['@scope%2fpkg?query=true', '@scope'],
  ['@scope%2fpkg%2f1.2.3', '@scope'],
  ['http://foo.bar:80/normal', ''],
  ['http://foo.bar:80/@scopedNoPkg', ''],
  ['http://foo.bar:80/@scoped/notescaped', ''],
  ['http://foo.bar:80/not@scope/pkg', ''],
  ['http://foo.bar:80/@scope?query=true', ''],
  ['http://foo.bar:80/@scope%2fpkg', '@scope'],
  ['http://foo.bar:80/@scope%2fpkg%2fext', '@scope'],
  ['http://foo.bar:80/@scope%2fpkg?query=true', '@scope'],
  ['http://foo.bar:80/@scope%2fpkg%2f1.2.3', '@scope'],
];

describe('isScopedPackage functional test', () => {
  test('identifies scope correctly', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    packageIdents.forEach(([pathname, scope]) => {
      expect(npmRegistry.isScopedPackage(pathname)).toEqual(!!scope.length);
    });
  });
});

describe('getScope functional test', () => {
  describe('matches scope correctly', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    packageIdents.forEach(([pathname, scope]) => {
      expect(npmRegistry.getScope(pathname)).toEqual(scope);
    });
  });
});

describe('getPossibleConfigLocations', () => {
  test('searches recursively to home directory', async () => {
    const testCwd = './project/subdirectory';
    const {mockRequestManager, mockRegistries} = createMocks();
    const reporter = new BufferReporter({verbose: true});
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, reporter);
    await npmRegistry.getPossibleConfigLocations('npmrc', reporter);

    const logs = reporter.getBuffer().map(logItem => logItem.data);
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.stringContaining(JSON.stringify(pathJoin('project', 'subdirectory', '.npmrc'))),
        expect.stringContaining(JSON.stringify(pathJoin('project', '.npmrc'))),
        expect.stringContaining(JSON.stringify(pathJoin(homeDir, '.npmrc'))),
      ]),
    );
  });
});
