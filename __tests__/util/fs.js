/* @flow */

import path from 'path';
import fs from 'fs';
import mkdir from './../_temp.js';
import {promisify} from '../../src/util/promise.js';
import {symlink, mkdirp, stat} from '../../src/util/fs.js';

const fsSymlink: (target: string, path: string, type?: 'dir' | 'file' | 'junction') => Promise<void> = promisify(
  fs.symlink,
);

describe('symlink', () => {
  test.concurrent("Doesn't make broken links when target itself has a deeper real path", async (): Promise<void> => {
    const scratch = await mkdir();

    // make a links directory that's actually a symlink itself
    await mkdirp(path.join(scratch, 'parent', 'links'));
    const linksPath = path.join(scratch, 'links');
    await fsSymlink(path.join('parent', 'links'), linksPath);

    // make a dummy package
    const packagePath = path.join(scratch, 'dummy');
    await mkdirp(packagePath);

    // symlinking the dummy package into the symlinked links directory should be ok
    const packageLinkPath = path.join(linksPath, 'dummy');
    await symlink(packagePath, packageLinkPath);
    expect(stat(packageLinkPath)).resolves.toBeTruthy();
  });
});
