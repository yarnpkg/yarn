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

test.concurrent('creates cmd file on Windows', async (): Promise<void> => {
  const linkFolder = await mkdir('link-folder');
  const prefix = await mkdir('prefix-folder');

  await fs.mkdirp(path.join(prefix, 'bin'));

  await runLink([], {linkFolder, prefix}, 'package-with-bin', async (config, reporter): Promise<void> => {
    const linkFolderExisted = await fs.exists(path.join(linkFolder, 'b-package'));
    expect(linkFolderExisted).toEqual(true);

    if (process.platform === 'win32') {
      const cmdExisted = await fs.exists(path.join(prefix, 'bin/file.cmd'));
      expect(cmdExisted).toEqual(true);
    }

    const binExisted = await fs.exists(path.join(prefix, 'bin/file'));
    expect(binExisted).toEqual(true);
  });

  await runUnlink([], {linkFolder, prefix}, 'package-with-bin', async (config, reporter): Promise<void> => {
    const linkFolderExisted = await fs.exists(path.join(linkFolder, 'b-package'));
    expect(linkFolderExisted).toEqual(false);

    if (process.platform === 'win32') {
      const cmdExisted = await fs.exists(path.join(prefix, 'bin/file.cmd'));
      expect(cmdExisted).toEqual(false);
    }

    const binExisted = await fs.exists(path.join(prefix, 'bin/file'));
    expect(binExisted).toEqual(false);
  });
});
