/* @flow */
/* eslint max-len: 0 */

import * as reporters from '../src/reporters/index.js';
import PackageResolver from '../src/package-resolver.js';
import Lockfile from '../src/lockfile/wrapper.js';
import Config from '../src/config.js';
import makeTemp from './_temp.js';
import * as fs from '../src/util/fs.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

const path = require('path');

function addTest(pattern, registry = 'npm') {
  // concurrently network requests tend to stall
  test(`resolve ${pattern}`, async () => {
    const lockfile = new Lockfile();
    const reporter = new reporters.NoopReporter({});

    const loc = await makeTemp();
    await fs.mkdirp(path.join(loc, 'node_modules'));
    const cacheFolder = path.join(loc, 'cache');
    await fs.mkdirp(cacheFolder);

    const config = new Config(reporter);
    await config.init({
      cwd: loc,
      cacheFolder,
    });
    const resolver = new PackageResolver(config, lockfile);
    await resolver.init([{pattern, registry}]);
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
addTest('https://github.com/babel/babel-loader.git#greenkeeper/cross-env-3.1.4'); // hash with slashes
addTest('gitlab:leanlabsio/kanban'); // gitlab
addTest('gist:d59975ac23e26ad4e25b'); // gist url
addTest('bitbucket:hgarcia/node-bitbucket-api'); // bitbucket url
addTest('scrollin'); // npm
addTest('gulp'); // npm
addTest('react-native'); // npm
addTest('ember-cli'); // npm
addTest('npm:gulp'); // npm
addTest('@polymer/iron-icon'); // npm scoped package
