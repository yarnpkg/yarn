/* @flow */

import {resolve, join as pathJoin} from 'path';

import NpmRegistry from '../../src/registries/npm-registry.js';
import {BufferReporter} from '../../src/reporters/index.js';
import homeDir, {home} from '../../src/util/user-home-dir.js';

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

  test('handles missing HOME', () => {
    const realHome = process.env.HOME;
    delete process.env.HOME;

    try {
      const normalized = NpmRegistry.normalizeConfig({cafile: '${HOME}/foo'})['cafile'];
      expect(normalized).toEqual(resolve(home, 'foo'));
    } finally {
      process.env.HOME = realHome;
    }
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
  // a helper function for creating an instance of npm registry,
  // making requests and inspecting request parameters
  function createRegistry(config: Object): Object {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);
    npmRegistry.config = config;
    return {
      request(url: string): Object {
        npmRegistry.request(url);
        const requestParams = mockRequestManager.request.mock.calls[0][0];
        return requestParams;
      },
    };
  }

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
      '@testScope:registry': 'https://some.other.registry/',
    };
    npmRegistry.request(url);

    const requestParams = mockRequestManager.request.mock.calls[0][0];

    expect(requestParams.headers.authorization).toBe('Bearer testScopedAuthToken');
  });

  test('should add authorization header with token for default registry when using npm login --scope=@foo', () => {
    const url = 'https://npmjs.registry.org/@foo%2fyarn.tgz';
    const config = {
      '//npmjs.registry.org/:_authToken': 'testScopedAuthToken',
      '@foo:registry': 'https://npmjs.registry.org/',
    };

    const requestParams = createRegistry(config).request(url);
    expect(requestParams.headers.authorization).toBe('Bearer testScopedAuthToken');
  });

  test('should add authorization header with token for yarn registry as default with a scoped package', () => {
    const url = 'https://registry.yarnpkg.com/@testScope%2fyarn.tgz';
    const config = {
      '//registry.yarnpkg.com/:_authToken': 'testScopedAuthToken',
      registry: 'https://registry.yarnpkg.com',
    };

    const requestParams = createRegistry(config).request(url);
    expect(requestParams.headers.authorization).toBe('Bearer testScopedAuthToken');
  });

  test('should add authorization header with token for per scope yarn registry with a scoped package', () => {
    const url = 'https://registry.yarnpkg.com/@testScope%2fyarn.tgz';
    const config = {
      '//registry.yarnpkg.com/:_authToken': 'testScopedAuthToken',
      '@testScope:registry': 'https://registry.yarnpkg.com',
    };
    const requestParams = createRegistry(config).request(url);
    expect(requestParams.headers.authorization).toBe('Bearer testScopedAuthToken');
  });

  test('should not add authorization header if default registry is yarn and npm token exists', () => {
    const url = 'https://registry.yarnpkg.com/@testScope%2fyarn.tgz';
    const config = {
      '//registry.npmjs.com/:_authToken': 'testScopedAuthToken',
      registry: 'https://registry.yarnpkg.com/',
    };

    const requestParams = createRegistry(config).request(url);
    expect(requestParams.headers.authorization).toBeUndefined();
  });

  test('should not add authorization header if request pathname does not match registry pathname', () => {
    const url = 'https://custom.registry.com/tarball/path/@testScope%2fyarn.tgz';
    const config = {
      '//custom.registry.com/meta/path/:_authToken': 'testScopedAuthToken',
      '@testScope:registry': 'https://custom.registry.com/meta/path/',
    };

    const requestParams = createRegistry(config).request(url);
    expect(requestParams.headers.authorization).toBeUndefined();
  });

  test('should add authorization header if request pathname matches registry pathname', () => {
    const url = 'https://custom.registry.com/custom/path/@testScope%2fyarn.tgz';
    const config = {
      '//custom.registry.com/custom/path/:_authToken': 'testScopedAuthToken',
      '@testScope:registry': 'https://custom.registry.com/custom/path/',
    };

    const requestParams = createRegistry(config).request(url);
    expect(requestParams.headers.authorization).toBe('Bearer testScopedAuthToken');
  });
});

const packageIdents = [
  ['normal', ''],
  ['@scopedNoPkg', ''],
  ['@scoped/notescaped', '@scoped'],
  ['not@scope/pkg', ''],
  ['@scope?query=true', ''],
  ['@scope%2fpkg', '@scope'],
  ['@scope%2fpkg%2fext', '@scope'],
  ['@scope%2fpkg?query=true', '@scope'],
  ['@scope%2fpkg%2f1.2.3', '@scope'],
  ['http://foo.bar:80/normal', ''],
  ['http://foo.bar:80/@scopedNoPkg', ''],
  ['http://foo.bar:80/@scoped/notescaped', '@scoped'],
  ['http://foo.bar:80/@scoped/notescaped/download/@scoped/notescaped-1.0.0.tgz', '@scoped'],
  ['http://foo.bar:80/not@scope/pkg', ''],
  ['http://foo.bar:80/@scope?query=true', ''],
  ['http://foo.bar:80/@scope%2fpkg', '@scope'],
  ['http://foo.bar:80/@scope%2fpkg%2fext', '@scope'],
  ['http://foo.bar:80/@scope%2fpkg?query=true', '@scope'],
  ['http://foo.bar:80/@scope%2fpkg%2f1.2.3', '@scope'],
  ['http://foo.bar:80/@scope%2fpkg/download/@scope%2fpkg-1.0.0.tgz', '@scope'],
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

describe('getRequestUrl functional test', () => {
  test('returns pathname when it is a full URL', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);
    const fullURL = 'HTTP://xn--xample-hva.com:80/foo/bar/baz';

    expect(npmRegistry.getRequestUrl('https://my.registry.co', fullURL)).toEqual(fullURL);
  });

  test('correctly handles registries lacking a trailing slash', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);
    const registry = 'https://my.registry.co/registry';
    const pathname = 'foo/bar/baz';

    expect(npmRegistry.getRequestUrl(registry, pathname)).toEqual('https://my.registry.co/registry/foo/bar/baz');
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

describe('checkOutdated functional test', () => {
  const mockConfig = {
    resolveConstraints(): string {
      return '2.0.0';
    },
  };

  test('homepage URL from top level', async () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    mockRequestManager.request = () => {
      return {
        homepage: 'http://package.homepage.com',
        'dist-tags': {
          latest: '2.0.0',
        },
        versions: {
          '2.0.0': {
            version: '2.0.0',
          },
        },
      };
    };

    const result = await npmRegistry.checkOutdated(mockConfig, 'left-pad', '2.0.0');

    expect(result).toMatchObject({
      latest: '2.0.0',
      wanted: '2.0.0',
      url: 'http://package.homepage.com',
    });
  });

  test('homepage URL fallback to wanted package manifest', async () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    mockRequestManager.request = () => {
      return {
        'dist-tags': {
          latest: '2.0.0',
        },
        versions: {
          '2.0.0': {
            version: '2.0.0',
            homepage: 'http://package.homepage.com',
          },
        },
      };
    };

    const result = await npmRegistry.checkOutdated(mockConfig, 'left-pad', '2.0.0');

    expect(result).toMatchObject({
      latest: '2.0.0',
      wanted: '2.0.0',
      url: 'http://package.homepage.com',
    });
  });

  test('repository URL from top level', async () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    mockRequestManager.request = () => {
      return {
        repository: {
          url: 'http://package.repo.com',
        },
        'dist-tags': {
          latest: '2.0.0',
        },
        versions: {
          '2.0.0': {
            version: '2.0.0',
          },
        },
      };
    };

    const result = await npmRegistry.checkOutdated(mockConfig, 'left-pad', '2.0.0');

    expect(result).toMatchObject({
      latest: '2.0.0',
      wanted: '2.0.0',
      url: 'http://package.repo.com',
    });
  });

  test('repository URL fallback to wanted package manifest', async () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter);

    mockRequestManager.request = () => {
      return {
        'dist-tags': {
          latest: '2.0.0',
        },
        versions: {
          '2.0.0': {
            version: '2.0.0',
            repository: {
              url: 'http://package.repo.com',
            },
          },
        },
      };
    };

    const result = await npmRegistry.checkOutdated(mockConfig, 'left-pad', '2.0.0');

    expect(result).toMatchObject({
      latest: '2.0.0',
      wanted: '2.0.0',
      url: 'http://package.repo.com',
    });
  });
});
