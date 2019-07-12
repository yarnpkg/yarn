/* @flow */

import {resolve, join as pathJoin} from 'path';

import NpmRegistry from '../../src/registries/npm-registry.js';
import {BufferReporter} from '../../src/reporters/index.js';
import homeDir, {home} from '../../src/util/user-home-dir.js';

function basicAuth(username, password): string {
  const pw = Buffer.from(String(password), 'base64').toString();
  return Buffer.from(String(username) + ':' + pw).toString('base64');
}

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
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter, true, []);
    npmRegistry.config = config;
    return {
      setOtp(otp: string) {
        npmRegistry.setOtp(otp);
      },

      request(url: string, options: Object, packageName: string): Object {
        npmRegistry.request(url, options, packageName);
        const lastIndex = mockRequestManager.request.mock.calls.length - 1;
        const requestParams = mockRequestManager.request.mock.calls[lastIndex][0];
        return requestParams;
      },
    };
  }

  test('should call requestManager.request with url', () => {
    const url = 'https://github.com/yarnpkg/yarn.tgz';
    const config = {};
    const requestParams = createRegistry(config).request(url);
    expect(requestParams.url).toBe(url);
  });

  test('should add `npm-otp` header', () => {
    const url = 'https://registry.npmjs.org/yarn';
    const config = {};
    const registry = createRegistry(config);

    registry.setOtp('123 456');

    const requestParams = registry.request(url);
    expect(requestParams.headers['npm-otp']).toBe('123 456');
  });

  const testCases = [
    {
      title: 'using npm as default registry and using private registry for scoped packages',
      config: {
        '//registry.myorg.com/:_authToken': 'scopedPrivateAuthToken',
        '@private:registry': 'https://registry.myorg.com/',
      },
      requests: [
        {
          url: 'yarn',
          pkg: 'yarn',
          expect: {root: 'https://registry.npmjs.org', auth: false},
        },
        {
          url: '@yarn%2fcore',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.npmjs.org', auth: false},
        },
        {
          url: '-/package/yarn/dist-tags',
          pkg: 'yarn',
          expect: {root: 'https://registry.npmjs.org', auth: false},
        },
        {
          url: '-/package/@yarn%2fcore/dist-tags',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.npmjs.org', auth: false},
        },
        {
          url: '-/user/token/abcdef',
          pkg: null,
          expect: {root: 'https://registry.npmjs.org', auth: false},
        },
        {
          url: 'https://registry.npmjs.org/dist/-/@yarn-core-1.0.0.tgz',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.npmjs.org', auth: false},
        },
        {
          url: 'https://registry.yarnpkg.com/dist/-/@yarn-core-1.0.0.tgz',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.yarnpkg.com', auth: false},
        },
        {
          url: 'https://registry.yarnpkg.com/dist/-/@yarn-core-1.0.0.tgz',
          pkg: null,
          expect: {root: 'https://registry.yarnpkg.com', auth: false},
        },
        {
          url: 'https://some.cdn.com/@yarn/core.tgz',
          pkg: '@yarn/core',
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: 'https://some.cdn.com/@yarn/core.tgz',
          pkg: null,
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: '@private/pkg',
          pkg: '@private/pkg',
          expect: {root: 'https://registry.myorg.com', auth: 'scopedPrivateAuthToken'},
        },
        {
          url: 'https://some.cdn.com/some-hash/@private-pkg-1.0.0.tar.gz',
          pkg: '@private/pkg',
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: 'https://some.cdn.com/@private/pkg',
          pkg: null,
          expect: {root: 'https://some.cdn.com', auth: false},
        },
      ],
    },
    {
      title: 'using scoped packages in both npm and private registry',
      config: {
        '//registry.npmjs.org/:_authToken': 'scopedNpmAuthToken',
        '@yarn:registry': 'https://registry.npmjs.org/',
        '//registry.myorg.com/:_authToken': 'scopedPrivateAuthToken',
        '@private:registry': 'https://registry.myorg.com/',
      },
      requests: [
        {
          url: 'yarn',
          pkg: 'yarn',
          expect: {root: 'https://registry.npmjs.org', auth: false},
        },
        {
          url: '@yarn%2fcore',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.npmjs.org', auth: 'scopedNpmAuthToken'},
        },
        {
          url: '-/package/yarn/dist-tags',
          pkg: 'yarn',
          expect: {root: 'https://registry.npmjs.org', auth: false},
        },
        {
          url: '-/package/@yarn%2fcore/dist-tags',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.npmjs.org', auth: 'scopedNpmAuthToken'},
        },
        {
          url: '-/user/token/abcdef',
          pkg: null,
          expect: {root: 'https://registry.npmjs.org', auth: false},
        },
        {
          url: 'https://registry.npmjs.org/dist/-/@yarn-core-1.0.0.tgz',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.npmjs.org', auth: 'scopedNpmAuthToken'},
        },
        {
          url: 'https://registry.yarnpkg.com/dist/-/@yarn-core-1.0.0.tgz',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.yarnpkg.com', auth: 'scopedNpmAuthToken'},
        },
        {
          url: 'https://registry.yarnpkg.com/dist/-/@yarn-core-1.0.0.tgz',
          pkg: null,
          expect: {root: 'https://registry.yarnpkg.com', auth: false},
        },
        {
          url: 'https://some.cdn.com/@yarn/core.tgz',
          pkg: '@yarn/core',
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: 'https://some.cdn.com/@yarn/core.tgz',
          pkg: null,
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: '@private/pkg',
          pkg: '@private/pkg',
          expect: {root: 'https://registry.myorg.com', auth: 'scopedPrivateAuthToken'},
        },
        {
          url: 'https://some.cdn.com/some-hash/@private-pkg-1.0.0.tar.gz',
          pkg: '@private/pkg',
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: 'https://some.cdn.com/@private/pkg',
          pkg: null,
          expect: {root: 'https://some.cdn.com', auth: false},
        },
      ],
    },
    {
      title: 'using authenticated npm and using private registry for scoped packages',
      config: {
        _authToken: 'scopedNpmAuthToken',
        '//registry.myorg.com/:_authToken': 'scopedPrivateAuthToken',
        '@private:registry': 'https://registry.myorg.com/',
      },
      requests: [
        {
          url: 'yarn',
          pkg: 'yarn',
          expect: {root: 'https://registry.npmjs.org', auth: false},
        },
        {
          url: '@yarn%2fcore',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.npmjs.org', auth: 'scopedNpmAuthToken'},
        },
        {
          url: '-/package/yarn/dist-tags',
          pkg: 'yarn',
          expect: {root: 'https://registry.npmjs.org', auth: false},
        },
        {
          url: '-/package/@yarn%2fcore/dist-tags',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.npmjs.org', auth: 'scopedNpmAuthToken'},
        },
        {
          url: '-/user/token/abcdef',
          pkg: null,
          expect: {root: 'https://registry.npmjs.org', auth: false},
        },
        {
          url: 'https://registry.npmjs.org/dist/-/@yarn-core-1.0.0.tgz',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.npmjs.org', auth: 'scopedNpmAuthToken'},
        },
        {
          url: 'https://registry.yarnpkg.com/dist/-/@yarn-core-1.0.0.tgz',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.yarnpkg.com', auth: 'scopedNpmAuthToken'},
        },
        {
          url: 'https://registry.yarnpkg.com/dist/-/@yarn-core-1.0.0.tgz',
          pkg: null,
          expect: {root: 'https://registry.yarnpkg.com', auth: false},
        },
        {
          url: 'https://some.cdn.com/@yarn/core.tgz',
          pkg: '@yarn/core',
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: 'https://some.cdn.com/@yarn/core.tgz',
          pkg: null,
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: '@private/pkg',
          pkg: '@private/pkg',
          expect: {root: 'https://registry.myorg.com', auth: 'scopedPrivateAuthToken'},
        },
        {
          url: 'https://some.cdn.com/some-hash/@private-pkg-1.0.0.tar.gz',
          pkg: '@private/pkg',
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: 'https://some.cdn.com/@private/pkg',
          pkg: null,
          expect: {root: 'https://some.cdn.com', auth: false},
        },
      ],
    },
    {
      title: 'using npm with always-auth and using private registry for scoped packages',
      config: {
        'always-auth': true,
        '//registry.npmjs.org/:_authToken': 'npmAuthToken',
        '@private:registry': 'https://registry.myorg.com/',
        '//registry.myorg.com/:_authToken': 'scopedPrivateAuthToken',
      },
      requests: [
        {
          url: 'yarn',
          pkg: 'yarn',
          expect: {root: 'https://registry.npmjs.org', auth: 'npmAuthToken'},
        },
        {
          url: '@yarn%2fcore',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.npmjs.org', auth: 'npmAuthToken'},
        },
        {
          url: '-/package/yarn/dist-tags',
          pkg: 'yarn',
          expect: {root: 'https://registry.npmjs.org', auth: 'npmAuthToken'},
        },
        {
          url: '-/package/@yarn%2fcore/dist-tags',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.npmjs.org', auth: 'npmAuthToken'},
        },
        {
          url: '-/user/token/abcdef',
          pkg: null,
          expect: {root: 'https://registry.npmjs.org', auth: 'npmAuthToken'},
        },
        {
          url: 'https://registry.npmjs.org/dist/-/@yarn-core-1.0.0.tgz',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.npmjs.org', auth: 'npmAuthToken'},
        },
        {
          url: 'https://registry.yarnpkg.com/dist/-/@yarn-core-1.0.0.tgz',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.yarnpkg.com', auth: 'npmAuthToken'},
        },
        {
          url: 'https://registry.yarnpkg.com/dist/-/@yarn-core-1.0.0.tgz',
          pkg: null,
          expect: {root: 'https://registry.yarnpkg.com', auth: 'npmAuthToken'},
        },
        {
          url: 'https://some.cdn.com/@yarn/core.tgz',
          pkg: '@yarn/core',
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: 'https://some.cdn.com/@yarn/core.tgz',
          pkg: null,
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: '@private/pkg',
          pkg: '@private/pkg',
          expect: {root: 'https://registry.myorg.com', auth: 'scopedPrivateAuthToken'},
        },
        {
          url: 'https://some.cdn.com/some-hash/@private-pkg-1.0.0.tar.gz',
          pkg: '@private/pkg',
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: 'https://some.cdn.com/@private/pkg',
          pkg: null,
          expect: {root: 'https://some.cdn.com', auth: false},
        },
      ],
    },
    {
      title: 'using private registry as default registry and using scoped packages on npm registry',
      config: {
        'always-auth': true,
        registry: 'https://registry.myorg.com/',
        '//registry.myorg.com/:_authToken': 'privateAuthToken',
        '//registry.npmjs.org/:_authToken': 'scopedNpmAuthToken',
        '@yarn:registry': 'https://registry.npmjs.org/',
      },
      requests: [
        {
          url: 'yarn',
          pkg: 'yarn',
          expect: {root: 'https://registry.myorg.com', auth: 'privateAuthToken'},
        },
        {
          url: '@yarn%2fcore',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.npmjs.org', auth: 'scopedNpmAuthToken'},
        },
        {
          url: '-/package/yarn/dist-tags',
          pkg: 'yarn',
          expect: {root: 'https://registry.myorg.com', auth: 'privateAuthToken'},
        },
        {
          url: '-/package/@yarn%2fcore/dist-tags',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.npmjs.org', auth: 'scopedNpmAuthToken'},
        },
        {
          url: '-/user/token/abcdef',
          pkg: null,
          expect: {root: 'https://registry.myorg.com', auth: 'privateAuthToken'},
        },
        {
          url: 'https://registry.npmjs.org/dist/-/@yarn-core-1.0.0.tgz',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.npmjs.org', auth: 'scopedNpmAuthToken'},
        },
        {
          url: 'https://registry.yarnpkg.com/dist/-/@yarn-core-1.0.0.tgz',
          pkg: '@yarn/core',
          expect: {root: 'https://registry.yarnpkg.com', auth: 'scopedNpmAuthToken'},
        },
        {
          url: 'https://registry.yarnpkg.com/dist/-/@yarn-core-1.0.0.tgz',
          pkg: null,
          expect: {root: 'https://registry.yarnpkg.com', auth: false},
        },
        {
          url: 'https://some.cdn.com/@yarn/core.tgz',
          pkg: '@yarn/core',
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: 'https://some.cdn.com/@yarn/core.tgz',
          pkg: null,
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: '@private/pkg',
          pkg: '@private/pkg',
          expect: {root: 'https://registry.myorg.com', auth: 'privateAuthToken'},
        },
        {
          url: 'https://some.cdn.com/some-hash/@private-pkg-1.0.0.tar.gz',
          pkg: '@private/pkg',
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: 'https://some.cdn.com/@private/pkg',
          pkg: null,
          expect: {root: 'https://some.cdn.com', auth: false},
        },
      ],
    },
    {
      title: 'registry url and request url path sensitivity',
      config: {
        '@private:registry': 'https://registry.myorg.com/api/npm/registry/',
        '//registry.myorg.com/api/npm/registry/:_authToken': 'scopedPrivateAuthToken',
      },
      requests: [
        {
          url: 'https://registry.myorg.com/api/npm/registry/private---pkg.tar.gz',
          pkg: '@private/pkg',
          expect: {root: 'https://registry.myorg.com/api/npm/registry/', auth: 'scopedPrivateAuthToken'},
        },
        {
          url: 'https://registry.myorg.com/api/packages/private---pkg.tar.gz',
          pkg: '@private/pkg',
          expect: {root: 'https://registry.myorg.com/api/packages/', auth: false},
        },
      ],
    },
    {
      title: 'using custom-host-suffix for registries where pathnames play a role',
      config: {
        '@private:registry': 'https://registry.myorg.com/api/npm/registry/',
        '//registry.myorg.com/api/npm/registry/:_authToken': 'scopedPrivateAuthToken',
        'custom-host-suffix': 'registry.myorg.com',
      },
      requests: [
        {
          url: '@private/pkg',
          pkg: '@private/pkg',
          expect: {root: 'https://registry.myorg.com/api/npm/registry/', auth: 'scopedPrivateAuthToken'},
        },
        {
          url: 'https://some.cdn.com/some-hash/@private-pkg-1.0.0.tar.gz',
          pkg: '@private/pkg',
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: 'https://some.cdn.com/@private/pkg',
          pkg: null,
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: 'https://registry.myorg.com/api/packages/private---pkg.tar.gz',
          pkg: '@private/pkg',
          expect: {root: 'https://registry.myorg.com/api/packages/', auth: 'scopedPrivateAuthToken'},
        },
      ],
    },
    {
      title: 'using multiple config entries for registries where pathnames play a role',
      config: {
        '@private:registry': 'https://registry.myorg.com/api/npm/registry/',
        '//registry.myorg.com/api/npm/registry/:_authToken': 'scopedPrivateAuthToken',
        '//registry.myorg.com/api/packages/:_authToken': 'scopedPrivateAuthToken',
      },
      requests: [
        {
          url: '@private/pkg',
          pkg: '@private/pkg',
          expect: {root: 'https://registry.myorg.com/api/npm/registry/', auth: 'scopedPrivateAuthToken'},
        },
        {
          url: 'https://some.cdn.com/some-hash/@private-pkg-1.0.0.tar.gz',
          pkg: '@private/pkg',
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: 'https://some.cdn.com/@private/pkg',
          pkg: null,
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: 'https://registry.myorg.com/api/packages/private---pkg.tar.gz',
          pkg: '@private/pkg',
          expect: {root: 'https://registry.myorg.com/api/packages/', auth: 'scopedPrivateAuthToken'},
        },
      ],
    },
    {
      title: 'using username/password config for registries where pathnames play a role',
      config: {
        '@private:registry': 'https://registry.myorg.com/api/npm/registry/',
        '//registry.myorg.com/api/npm/registry/:username': 'scopedPrivateUsername',
        '//registry.myorg.com/api/npm/registry/:_password': 'scopedPrivatePassword',
        '//registry.myorg.com/api/packages/:username': 'scopedPrivateUsername',
        '//registry.myorg.com/api/packages/:_password': 'scopedPrivatePassword',
      },
      requests: [
        {
          url: '@private/pkg',
          pkg: '@private/pkg',
          expect: {
            root: 'https://registry.myorg.com/api/npm/registry/',
            auth: basicAuth('scopedPrivateUsername', 'scopedPrivatePassword'),
            basicAuth: true,
          },
        },
        {
          url: 'https://some.cdn.com/some-hash/@private-pkg-1.0.0.tar.gz',
          pkg: '@private/pkg',
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: 'https://some.cdn.com/@private/pkg',
          pkg: null,
          expect: {root: 'https://some.cdn.com', auth: false},
        },
        {
          url: 'https://registry.myorg.com/api/packages/private---pkg.tar.gz',
          pkg: '@private/pkg',
          expect: {
            root: 'https://registry.myorg.com/api/packages/',
            auth: basicAuth('scopedPrivateUsername', 'scopedPrivatePassword'),
            basicAuth: true,
          },
        },
      ],
    },
  ];

  testCases.forEach(testCase => {
    describe(testCase.title, () => {
      const registry = createRegistry(testCase.config);
      testCase.requests.forEach(req => {
        const desc =
          `with request url ${req.url}${req.pkg ? ` in context of package ${req.pkg}` : ''} ` +
          `auth is ${req.expect.auth ? req.expect.auth : 'not sent'}`;
        (req.skip ? it.skip : req.only ? it.only : it)(desc, () => {
          const requestParams = registry.request(req.url, {}, req.pkg);
          expect(requestParams.url.substr(0, req.expect.root.length)).toBe(req.expect.root);
          if (req.expect.basicAuth) {
            expect(requestParams.headers.authorization).toBe(req.expect.auth ? `Basic ${req.expect.auth}` : undefined);
          } else {
            expect(requestParams.headers.authorization).toBe(req.expect.auth ? `Bearer ${req.expect.auth}` : undefined);
          }
        });
      });
    });
  });
});

describe('isRequestToRegistry functional test', () => {
  test('request to registry url matching', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter, true, []);

    const validRegistryUrls = [
      ['http://foo.bar:80/foo/bar/baz', 'http://foo.bar/foo/'],
      ['http://foo.bar:80/foo/bar/baz', 'https://foo.bar/foo/'],
      ['http://foo.bar/foo/bar/baz', 'http://foo.bar/foo/'],
      ['http://foo.bar/foo/00000000-1111-4444-8888-000000000000/baz', 'http://foo.bar/foo/'],
      ['https://foo.bar:443/foo/bar/baz', 'https://foo.bar/foo/'],
      ['http://foo.bar/foo/bar/baz', 'https://foo.bar:443/foo/'],
      ['https://foo.bar/foo/bar/baz', 'https://foo.bar:443/foo/'],
      ['HTTP://xn--xample-hva.com:80/foo/bar/baz', 'http://êxample.com/foo/bar/baz'],
      // yarn and npm registries are interchangeable
      ['https://registry.npmjs.org/foo/bar', 'https://registry.npmjs.org/'],
      ['https://registry.yarnpkg.com/foo/bar', 'https://registry.npmjs.org/'],
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
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter, true, []);

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
    expect(npmRegistry.isRequestToRegistry('http://pkgs.host.com:80/foo/bar/baz', '//pkgs.host.com/bar/baz')).toBe(
      true,
    );
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
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter, true, []);

    packageIdents.forEach(([pathname, scope]) => {
      expect(npmRegistry.isScopedPackage(pathname)).toEqual(!!scope.length);
    });
  });
});

describe('environment variables functional test', () => {
  beforeEach(() => {
    process.env.npm_config_always_auth = 'true';
    process.env.npm_config__auth = 'auth';
    process.env.npm_config__authtoken = 'authToken';
    process.env.npm_config__username = 'username';
    process.env.npm_config__password = 'password';
  });

  afterEach(() => {
    delete process.env.npm_config_always_auth;
    delete process.env.npm_config__auth;
    delete process.env.npm_config__authToken;
    delete process.env.npm_config__username;
    delete process.env.npm_config__password;
  });

  test('correctly escapes environment config variables', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter, true, []);

    npmRegistry.mergeEnv('npm_config_');
    expect(npmRegistry.config).toHaveProperty('always-auth', true);
    expect(npmRegistry.config).toHaveProperty('_auth', 'auth');
    expect(npmRegistry.config).toHaveProperty('_authtoken', 'authToken');
    expect(npmRegistry.config).toHaveProperty('_username', 'username');
    expect(npmRegistry.config).toHaveProperty('_password', 'password');
  });
});

describe('getRequestUrl functional test', () => {
  test('returns pathname when it is a full URL', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter, true, []);
    const fullURL = 'HTTP://xn--xample-hva.com:80/foo/bar/baz';

    expect(npmRegistry.getRequestUrl('https://my.registry.co', fullURL)).toEqual(fullURL);
  });

  test('correctly handles registries lacking a trailing slash', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter, true, []);
    const registry = 'https://my.registry.co/registry';
    const pathname = 'foo/bar/baz';

    expect(npmRegistry.getRequestUrl(registry, pathname)).toEqual('https://my.registry.co/registry/foo/bar/baz');
  });

  for (const host of [`registry.yarnpkg.com`, `registry.npmjs.org`, `registry.npmjs.com`]) {
    test(`enforces loading packages through https when they come from ${host}`, () => {
      const testCwd = '.';
      const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
      const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter, true, []);
      const registry = `http://${host}/registry`;
      const pathname = 'foo/bar/baz';

      expect(npmRegistry.getRequestUrl(registry, pathname)).toEqual(`https://${host}/registry/foo/bar/baz`);
    });
  }

  test("doesn't change the protocol for packages from other registries", () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter, true, []);
    const registry = 'http://registry.mylittlepony.org/registry';
    const pathname = 'foo/bar/baz';

    expect(npmRegistry.getRequestUrl(registry, pathname)).toEqual(
      'http://registry.mylittlepony.org/registry/foo/bar/baz',
    );
  });
});

describe('getScope functional test', () => {
  describe('matches scope correctly', () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter, true, []);

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
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, reporter, true, []);
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
    reporter: new BufferReporter({verbose: true}),
  };

  test('homepage URL from top level', async () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter, true, []);

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
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter, true, []);

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
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter, true, []);

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
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter, true, []);

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

  test('unpublished package (no versions)', async () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter, true, []);

    mockRequestManager.request = () => {
      return {
        'dist-tags': {
          latest: '2.0.0',
        },
        versions: {},
      };
    };

    let message;
    try {
      await npmRegistry.checkOutdated(mockConfig, 'left-pad', '2.0.0');
    } catch (err) {
      message = err.message;
    }

    expect(message).toEqual(expect.stringContaining('No valid versions'));
  });

  test('latest version fallback to wanted package manifest', async () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter, true, []);

    mockRequestManager.request = () => {
      return {
        'dist-tags': {},
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

  test('package with an empty response', async () => {
    const testCwd = '.';
    const {mockRequestManager, mockRegistries, mockReporter} = createMocks();
    const npmRegistry = new NpmRegistry(testCwd, mockRegistries, mockRequestManager, mockReporter, true, []);

    mockRequestManager.request = () => {
      return {};
    };

    let message;
    try {
      await npmRegistry.checkOutdated(mockConfig, 'left-pad', '2.0.0');
    } catch (err) {
      message = err.message;
    }

    expect(message).toEqual(expect.stringContaining('malformed response from registry for "left-pad"'));
  });
});
