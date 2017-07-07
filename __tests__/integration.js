/* @flow */
/* eslint max-len: 0 */

import execa from 'execa';
import makeTemp from './_temp.js';
import * as fs from '../src/util/fs.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

const path = require('path');

function addTest(pattern, init: ?(cacheFolder: string) => Promise<any>, offline = false) {
  // concurrently network requests tend to stall
  test(`yarn add ${pattern}`, async () => {
    const loc = await makeTemp();
    const cacheFolder = path.join(loc, 'cache');

    const command = path.resolve(__dirname, '../bin/yarn');
    const args = ['--cache-folder', cacheFolder, '--verbose'];

    const options = {cwd: loc};

    if (offline) {
      args.push('--offline');
    }

    if (init) {
      await fs.mkdirp(cacheFolder);
      await init(cacheFolder);
    }

    await fs.writeFile(path.join(loc, 'package.json'), JSON.stringify({name: 'test'}));

    await execa(command, ['add', pattern].concat(args), options);
  });
}

// TODO:
// addTest('gitlab:leanlabsio/kanban'); // gitlab
// addTest(
//   '@foo/bar@1.2.3',
//   async cacheFolder => {
//     const folder = path.join(cacheFolder, 'v1', 'npm-@foo', 'bar');
//     await fs.mkdirp(folder);
//     await fs.writeFile(
//       path.join(folder, constants.METADATA_FILENAME),
//       '{"remote": {"hash": "cafebabecafebabecafebabecafebabecafebabe"}}',
//     );
//     await fs.writeFile(path.join(folder, 'package.json'), '{"name": "@foo/bar", "version": "1.2.3"}');
//   },
//   true,
// ); // offline npm scoped package

addTest('scrollin'); // npm
addTest('https://git@github.com/stevemao/left-pad.git'); // git url, with username
addTest('https://github.com/yarnpkg/yarn/releases/download/v0.18.1/yarn-v0.18.1.tar.gz'); // tarball
addTest('https://github.com/bestander/chrome-app-livereload.git'); // no package.json
addTest('bestander/chrome-app-livereload'); // no package.json, github, tarball
