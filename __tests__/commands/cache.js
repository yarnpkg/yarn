/* @flow */

import type {CLIFunctionReturn} from '../../src/types.js';
import * as reporters from '../../src/reporters/index.js';
import * as configCmd from '../../src/cli/commands/config.js';
import {run as buildRun} from './_helpers.js';
import * as fs from '../../src/util/fs.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

const runConfig = buildRun.bind(
  null,
  reporters.ConsoleReporter,
  '',
  (args, flags, config, reporter): CLIFunctionReturn => {
    return configCmd.run(config, reporter, flags, args);
  },
);

test.concurrent('write cache-folder config into .yarnrc file', (): Promise<void> => {
  return runConfig(['set', 'cache-folder', 'folder_dir_for_test'], {}, '', async (config) => {
    const configFile = await fs.readFile(config.registries.yarn.homeConfigLoc);
    expect(configFile).toContain('folder_dir_for_test');
  });
});
