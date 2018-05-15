/* @flow */

import YarnRegistry from '../../src/registries/yarn-registry.js';
import {BufferReporter} from '../../src/reporters/index.js';
import {YARN_REGISTRY} from '../../src/constants.js';

function createMocks(): Object {
  const mockRequestManager = {
    request: jest.fn(),
  };

  const mockRegistries = {
    npm: {
      getOption(key): mixed {
        return this.config[key];
      },
    },
    yarn: {},
  };

  const reporter = new BufferReporter({verbose: true});

  return {
    mockRequestManager,
    mockRegistries,
    reporter,
  };
}

describe('yarn registry getOption', () => {
  test('that getOption falls back to npm if the key is defined as a npm config and also is a yarn default', () => {
    const {mockRequestManager, mockRegistries, reporter} = createMocks();
    const yarnRegistry = new YarnRegistry('.', mockRegistries, mockRequestManager, reporter);

    mockRegistries.npm.config = {
      registry: 'npm:custom-registry',
    };

    yarnRegistry.config = {
      registry: YARN_REGISTRY,
    };

    yarnRegistry.configWithoutDefaults = {};

    expect(yarnRegistry.getOption('registry')).toEqual('npm:custom-registry');
  });

  test('that getOption will respect custom yarn options over npm', () => {
    const {mockRequestManager, mockRegistries, reporter} = createMocks();
    const yarnRegistry = new YarnRegistry('.', mockRegistries, mockRequestManager, reporter);

    mockRegistries.npm.config = {
      registry: 'npm:custom-registry',
    };

    yarnRegistry.config = {
      registry: 'yarn:custom-registry',
    };

    yarnRegistry.configWithoutDefaults = {
      registry: 'yarn:custom-registry',
    };

    expect(yarnRegistry.getOption('registry')).toEqual('yarn:custom-registry');
  });

  test('that if a option is not defined on either yarn or npm we use yarns default', () => {
    const {mockRequestManager, mockRegistries, reporter} = createMocks();
    const yarnRegistry = new YarnRegistry('.', mockRegistries, mockRequestManager, reporter);

    mockRegistries.npm.config = {};

    yarnRegistry.config = {
      registry: YARN_REGISTRY,
    };

    yarnRegistry.configWithoutDefaults = {};

    expect(yarnRegistry.getOption('registry')).toEqual(YARN_REGISTRY);
  });

  test('that if the yarn config value is the same as the default it will be used', () => {
    const {mockRequestManager, mockRegistries, reporter} = createMocks();
    const yarnRegistry = new YarnRegistry('.', mockRegistries, mockRequestManager, reporter);

    mockRegistries.npm.config = {
      registry: 'npm:registry',
    };

    yarnRegistry.config = {
      registry: YARN_REGISTRY,
    };

    yarnRegistry.configWithoutDefaults = {
      registry: YARN_REGISTRY,
    };

    expect(yarnRegistry.getOption('registry')).toEqual(YARN_REGISTRY);
  });
});
