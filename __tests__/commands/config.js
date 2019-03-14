/* @flow */

import type {CLIFunctionReturn} from '../../src/types.js';
import * as reporters from '../../src/reporters/index.js';
import * as configCmd from '../../src/cli/commands/config.js';
import {run as buildRun} from './_helpers.js';
import * as fs from '../../src/util/fs.js';

const path = require('path');

const runConfig = buildRun.bind(
  null,
  reporters.ConsoleReporter,
  '',
  (args, flags, config, reporter): CLIFunctionReturn => {
    config.registries.yarn.homeConfigLoc = path.join(config.cwd, '.yarnrc');
    return configCmd.run(config, reporter, flags, args);
  },
);

test('write cache-folder config into .yarnrc file', (): Promise<void> => {
  return runConfig(['set', 'cache-folder', 'folder_dir_for_test'], {}, '', async config => {
    const configFile = await fs.readFile(config.registries.yarn.homeConfigLoc);
    expect(configFile).toContain('folder_dir_for_test');
  });
});

test('cache-folder flag has higher priorities than .yarnrc file', (): Promise<void> => {
  return runConfig(
    ['set', 'cache-folder', 'set_config_folder_dir'],
    {cacheFolder: 'flag_config_folder_dir'},
    '',
    config => {
      expect(config.cacheFolder).toContain('flag_config_folder_dir');
    },
  );
});

test('write global-folder config into .yarnrc file', (): Promise<void> => {
  return runConfig(['set', 'global-folder', 'folder_dir_for_test'], {}, '', async config => {
    const configFile = await fs.readFile(config.registries.yarn.homeConfigLoc);
    expect(configFile).toContain('folder_dir_for_test');
  });
});

test('global-folder flag has higher priorities than .yarnrc file', (): Promise<void> => {
  return runConfig(
    ['set', 'global-folder', 'set_config_folder_dir'],
    {globalFolder: 'flag_config_folder_dir'},
    '',
    config => {
      expect(config.globalFolder).toContain('flag_config_folder_dir');
    },
  );
});

test('bin-links flag has higher priorities than .yarnrc file', (): Promise<void> => {
  return runConfig(['set', 'bin-links', 'true'], {binLinks: false}, '', config => {
    expect(config.binLinks).toBe(false);
  });
});

test('set true when option value is undefined', (): Promise<void> => {
  return runConfig(['set', 'strict-ssl'], {}, '', config => {
    expect(config.registries.yarn.homeConfig['strict-ssl']).toBe(true);
  });
});

test('set empty string to an option', (): Promise<void> => {
  return runConfig(['set', 'version-tag-prefix', ''], {}, '', config => {
    expect(config.registries.yarn.homeConfig['version-tag-prefix']).toBe('');
  });
});

test('set value "false" to an option', (): Promise<void> => {
  return runConfig(['set', 'strict-ssl', 'false'], {}, '', config => {
    expect(config.registries.yarn.homeConfig['strict-ssl']).toBe(false);
  });
});

test('set value "true" to an option', (): Promise<void> => {
  return runConfig(['set', 'strict-ssl', 'true'], {}, '', config => {
    expect(config.registries.yarn.homeConfig['strict-ssl']).toBe(true);
  });
});
