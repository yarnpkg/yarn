/* @flow */
/* eslint max-len: 0 */

import * as reporters from '../src/reporters/index.js';
import PackageResolver from '../src/package-resolver.js';
import Lockfile from '../src/lockfile/wrapper.js';
import Config from '../src/config.js';
import makeTemp from './_temp.js';
import * as fs from '../src/util/fs.js';
import * as constants from '../src/constants.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

const path = require('path');

// regexp which verifies that cache path contains semver + hash
const cachePathRe = /-\d+\.\d+\.\d+-[\dabcdef]{40}$/;

function addTest(pattern, registry = 'npm', init: ?(cacheFolder: string) => Promise<any>, offline = false) {
  // concurrently network requests tend to stall
  test(`${offline ? 'offline ' : ''}resolve ${pattern}`, async () => {
    const lockfile = new Lockfile();
    const reporter = new reporters.NoopReporter({});

    const loc = await makeTemp();
    const cacheFolder = path.join(loc, 'cache');

    const config = await Config.create(
      {
        cwd: loc,
        offline,
        cacheFolder,
      },
      reporter,
    );

    await fs.mkdirp(path.join(loc, 'node_modules'));
    await fs.mkdirp(config.cacheFolder);

    if (init) {
      await init(config.cacheFolder);
    }

    const resolver = new PackageResolver(config, lockfile);
    await resolver.init([{pattern, registry}]);

    const ref = resolver.getManifests()[0]._reference;
    const cachePath = config.generateHardModulePath(ref, true);
    expect(cachePath).toMatch(cachePathRe);

    await reporter.close();
  });
}

// TODO Got broken for some time, needs revision
// addTest('https://github.com/npm-ml/re'); // git url with no .git
// addTest('git+https://github.com/npm-ml/ocaml.git#npm-4.02.3'); // git+hash
// addTest('https://github.com/npm-ml/ocaml.git#npm-4.02.3'); // hash
addTest('https://git@github.com/stevemao/left-pad.git'); // git url, with username
addTest('https://bitbucket.org/hgarcia/node-bitbucket-api.git'); // hosted git url
addTest('https://github.com/yarnpkg/yarn/releases/download/v0.18.1/yarn-v0.18.1.tar.gz'); // tarball
addTest('https://github.com/yarnpkg/e2e-test-repo.git#greenkeeper/cross-env-3.1.4'); // hash with slashes
addTest('https://github.com/bestander/chrome-app-livereload.git'); // no package.json
addTest('livereload@https://github.com/bestander/chrome-app-livereload.git'); // no package.json, named
addTest('bestander/chrome-app-livereload'); // no package.json, github
addTest('livereload@https://github.com/bestander/chrome-app-livereload/archive/0.0.5.tar.gz'); // no package.json, targz
addTest('gitlab:leanlabsio/kanban'); // gitlab
addTest('gist:d59975ac23e26ad4e25b'); // gist url
addTest('bitbucket:hgarcia/node-bitbucket-api'); // bitbucket url
addTest('scrollin'); // npm
addTest('gulp'); // npm
addTest('react-native'); // /npm
addTest('ember-cli'); // npm
addTest('npm:gulp'); // npm
addTest('@polymer/iron-icon'); // npm scoped package
addTest(
  '@foo/bar@1.2.3',
  'npm',
  async cacheFolder => {
    const folder = path.join(cacheFolder, 'npm-@foo', 'bar');
    await fs.mkdirp(folder);
    await fs.writeFile(
      path.join(folder, constants.METADATA_FILENAME),
      '{"remote": {"hash": "cafebabecafebabecafebabecafebabecafebabe"}}',
    );
    await fs.writeFile(path.join(folder, 'package.json'), '{"name": "@foo/bar", "version": "1.2.3"}');
  },
  true,
); // offline npm scoped package
