/* @flow */

import {run as buildRun} from './_helpers.js';
import {run as link} from '../../src/cli/commands/link.js';
import {run as unlink} from '../../src/cli/commands/unlink.js';
import {ConsoleReporter} from '../../src/reporters/index.js';
import type {CLIFunctionReturn} from '../../src/types.js';
import mkdir from './../_temp.js';
import * as fs from '../../src/util/fs.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'link');
const runLink = buildRun.bind(
  null,
  ConsoleReporter,
  fixturesLoc,
  (args, flags, config, reporter): CLIFunctionReturn => {
    return link(config, reporter, flags, args);
  },
);

const runUnlink = buildRun.bind(
  null,
  ConsoleReporter,
  fixturesLoc,
  async (args, flags, config, reporter): CLIFunctionReturn => {
    await link(config, reporter, flags, args);
    return unlink(config, reporter, flags, args);
  },
);

test.concurrent('creates folder in linkFolder', async (): Promise<void> => {
  const linkFolder = await mkdir('link-folder');

  await runLink([], {linkFolder}, 'package-with-name', async (config, reporter): Promise<void> => {
    const existed = await fs.exists(path.join(linkFolder, 'a-package'));
    expect(existed).toEqual(true);
  });

  await runUnlink([], {linkFolder}, 'package-with-name', async (config, reporter): Promise<void> => {
    const existed = await fs.exists(path.join(linkFolder, 'a-package'));
    expect(existed).toEqual(false);
  });
});

test.concurrent('throws error if package.json does not have name', async (): Promise<void> => {
  const linkFolder = await mkdir('link-folder');
  const reporter = new ConsoleReporter({});

  try {
    await runUnlink([], {linkFolder}, 'package-no-name', () => {});
  } catch (err) {
    expect(err.message).toContain(reporter.lang('unknownPackageName'));
  }
});
