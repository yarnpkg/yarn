/* @flow */
/* eslint max-len: 0 */

import * as reporters from '../src/reporters/index.js';
import PackageResolver from '../src/package-resolver.js';
import * as constants from '../src/constants.js';
import Lockfile from '../src/lockfile/wrapper.js';
import Config from '../src/config.js';
import makeTemp from './_temp.js';
import * as fs from '../src/util/fs.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

const path = require('path');

function addTest(pattern, registry = 'npm') {
  // TODO renable these test.concurrent
  xit(`resolve ${pattern}`, async () => {
    const lockfile = new Lockfile();
    const reporter = new reporters.NoopReporter({});

    const loc = await makeTemp();
    await fs.mkdirp(path.join(loc, 'node_modules'));
    await fs.mkdirp(path.join(loc, constants.MODULE_CACHE_DIRECTORY));

    const config = new Config(reporter);
    await config.init({
      cwd: loc,
      cacheFolder: loc,
      tempFolder: loc,
    });
    const resolver = new PackageResolver(config, lockfile);
    await resolver.init([{pattern, registry}]);
    await reporter.close();
  });
}

addTest('github:PolymerElements/paper-elements', 'bower'); // github url
addTest('https://github.com/PolymerElements/font-roboto.git', 'bower'); // hosted git url
addTest('https://github.com/npm-ml/re'); // git url with no .git
addTest('https://bitbucket.org/hgarcia/node-bitbucket-api.git'); // hosted git url
addTest('https://github.com/PolymerElements/font-roboto/archive/2fd5c7bd715a24fb5b250298a140a3ba1b71fe46.tar.gz'); // tarball
addTest('https://github.com/npm-ml/ocaml.git#npm-4.02.3'); // hash
addTest('https://git@github.com/babel/babylon.git'); // git url, with username
addTest('https://github.com/babel/babel-loader.git#feature/sourcemaps'); // hash with slashes
addTest('git+https://github.com/npm-ml/ocaml.git#npm-4.02.3'); // git+hash
addTest('gitlab:leanlabsio/kanban'); // gitlab
addTest('gist:d59975ac23e26ad4e25b'); // gist url
addTest('bitbucket:hgarcia/node-bitbucket-api'); // bitbucket url
addTest('scrollin'); // npm
addTest('gulp'); // npm
addTest('react-native'); // npm
addTest('ember-cli'); // npm
addTest('npm:gulp'); // npm
addTest('@polymer/iron-icon'); // npm scoped package
