/* @flow */

import {run as buildRun} from './_helpers.js';
import {run as publish} from '../../src/cli/commands/publish.js';
import {ConsoleReporter} from '../../src/reporters/index.js';

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'publish');

const setupMocks = function(config) {
  // Mock actual network request so that no package is actually published.
  // $FlowFixMe
  config.registries.npm.request = jest.fn();
  config.registries.npm.request.mockReturnValue(
    new Promise(resolve => {
      resolve({status: 200});
    }),
  );

  // Mock the npm login name. Otherwise yarn will prompt for it and break CI.
  // $FlowFixMe
  config.registries.npm.getAuth = jest.fn();
  config.registries.npm.getAuth.mockReturnValue('test');
  // $FlowFixMe
  config.registries.npm.getAuthByRegistry = jest.fn();
  config.registries.npm.getAuthByRegistry.mockReturnValue('test2');
};

const runPublish = buildRun.bind(
  null,
  ConsoleReporter,
  fixturesLoc,
  async (args, flags, config, reporter, lockfile, getStdout): Promise<string> => {
    setupMocks(config);
    await publish(config, reporter, flags, args);
    return getStdout();
  },
);

test.concurrent('publish should default access to undefined', () => {
  return runPublish([], {newVersion: '0.0.1'}, 'minimal', config => {
    expect(config.registries.npm.request).toBeCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.objectContaining({
          access: undefined,
        }),
      }),
    );
  });
});

test.concurrent('publish should accept `--access restricted` argument', () => {
  return runPublish([], {newVersion: '0.0.1', access: 'restricted'}, 'minimal', config => {
    expect(config.registries.npm.request).toBeCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.objectContaining({
          access: 'restricted',
        }),
      }),
    );
  });
});

test.concurrent('publish should accept `--access public` argument', () => {
  return runPublish([], {newVersion: '0.0.1', access: 'public'}, 'minimal', config => {
    expect(config.registries.npm.request).toBeCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.objectContaining({
          access: 'public',
        }),
      }),
    );
  });
});

test.concurrent('publish should use publishConfig.access in package manifest', () => {
  return runPublish([], {newVersion: '0.0.1'}, 'public', config => {
    expect(config.registries.npm.request).toBeCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.objectContaining({
          access: 'public',
        }),
      }),
    );
  });
});

test.concurrent('publish should allow `--access` to override publishConfig.access', () => {
  return runPublish([], {newVersion: '0.0.1', access: 'restricted'}, 'public', config => {
    expect(config.registries.npm.request).toBeCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.objectContaining({
          access: 'restricted',
        }),
      }),
    );
  });
});

test.concurrent('publish should run lifecycle scripts in the correct order', () => {
  return runPublish([], {newVersion: '1.0.0'}, 'lifecycle-scripts', (config, reporter, stdout) => {
    expect(stdout).toMatch(
      new RegExp(
        [
          'running the prepublish hook[\\s\\S]*',
          'running the prepare hook[\\s\\S]*',
          'running the prepublishOnly hook[\\s\\S]*',
          'running the prepack hook[\\s\\S]*',
          'running the postpack hook[\\s\\S]*',
          'running the publish hook[\\s\\S]*',
          'running the postpublish hook',
        ].join(''),
        'm',
      ),
    );
  });
});

test.concurrent('can specify a path', () => {
  return runPublish(['mypkg'], {newVersion: '0.0.1'}, 'subdir', config => {
    expect(config.registries.npm.request).toBeCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.objectContaining({
          access: undefined,
        }),
      }),
    );
  });
});

test.concurrent('can specify a path without `--new-version`', () => {
  return runPublish(['mypkg'], {}, 'subdir', config => {
    expect(config.registries.npm.request).toBeCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.objectContaining({
          access: undefined,
        }),
      }),
    );
  });
});

test.concurrent('publish should respect publishConfig.registry ', () => {
  const registry = 'https://registry.myorg.com/';

  return runPublish([], {}, 'publish-config-registry', config => {
    expect(config.registries.npm.request).toBeCalledWith(
      expect.any(String),
      expect.objectContaining({
        registry,
      }),
    );
    expect(config.registries.npm.getAuthByRegistry).toBeCalledWith(registry);
  });
});

test.concurrent('publish with publishConfig.registry and --registry', () => {
  const registry = 'https://registry.myorg.com/';
  const registry2 = 'https://registry2.myorg.com/';

  return runPublish([], {registry: registry2}, 'publish-config-registry', config => {
    expect(config.registries.npm.request).toBeCalledWith(
      expect.any(String),
      expect.objectContaining({
        registry,
      }),
    );
    expect(config.registries.npm.getAuthByRegistry).toBeCalledWith(registry);
  });
});
