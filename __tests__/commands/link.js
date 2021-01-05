/* @flow */

import {runLink} from './_helpers.js';
import {ConsoleReporter} from '../../src/reporters/index.js';
import mkdir from './../_temp.js';
import {promisify} from '../../src/util/promise.js';
import * as fs from '../../src/util/fs.js';

const path = require('path');
const stdFs = require('fs');

const fsSymlink: (target: string, path: string, type?: 'dir' | 'file' | 'junction') => Promise<void> = promisify(
  stdFs.symlink,
);

test.concurrent('creates folder in linkFolder', async (): Promise<void> => {
  const linkFolder = await mkdir('link-folder');
  await runLink([], {linkFolder}, 'package-with-name', async (config, reporter): Promise<void> => {
    const existed = await fs.exists(path.join(linkFolder, 'a-package'));
    expect(existed).toEqual(true);
  });
});

test.concurrent("doesn't create a broken link if link folder has a deeper real path", async (): Promise<void> => {
  const scratch = await mkdir('scratch');

  // make a links directory that's actually a symlink itself
  await fs.mkdirp(path.join(scratch, 'parent', 'link-folder'));
  const linkFolder = path.join(scratch, 'link-folder');
  await fsSymlink(path.join('parent', 'link-folder'), linkFolder);

  await runLink([], {linkFolder}, 'package-with-name', async (config, reporter): Promise<void> => {
    const existed = await fs.exists(path.join(linkFolder, 'a-package'));
    expect(existed).toEqual(true);
  });
});

test.concurrent('throws error if package.json does not have name', async (): Promise<void> => {
  const linkFolder = await mkdir('link-folder');
  const reporter = new ConsoleReporter({});

  try {
    await runLink([], {linkFolder}, 'package-no-name', () => {});
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
});
