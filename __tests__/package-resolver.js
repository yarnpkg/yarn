/* @flow */
/* eslint max-len: 0 */

import * as reporters from '../src/reporters/index.js';
import PackageResolver from '../src/package-resolver.js';
import Lockfile from '../src/lockfile';
import Config from '../src/config.js';
import makeTemp from './_temp.js';
import * as fs from '../src/util/fs.js';
import * as constants from '../src/constants.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const path = require('path');

// regexp which verifies that the cache path contains a path component ending with semver + hash
const cachePathRe = /-\d+\.\d+\.\d+-[\dabcdef]{40}[\\\/]/;

async function createEnv(configOptions): Object {
  const lockfile = new Lockfile();
  const reporter = new reporters.NoopReporter({});

  const loc = await makeTemp();
  const cacheFolder = path.join(loc, 'cache');

  const config = await Config.create(
    {
      cwd: loc,
      offline: false,
      cacheFolder,
      ...configOptions,
    },
    reporter,
  );

  await fs.mkdirp(path.join(loc, 'node_modules'));
  await fs.mkdirp(config.cacheFolder);

  return {reporter, lockfile, config};
}

function addTest(pattern, registry = 'npm', init: ?(cacheFolder: string) => Promise<any>, offline = false) {
  test.concurrent(`${offline ? 'offline ' : ''}resolve ${pattern}`, async () => {
    const {reporter, lockfile, config} = await createEnv({offline});

    if (init) {
      await init(config.cacheFolder);
    }

    const resolver = new PackageResolver(config, lockfile);
    await resolver.init([{pattern, registry}]);

    const ref = resolver.getManifests()[0]._reference;
    const cachePath = config.generateModuleCachePath(ref);
    expect(cachePath).toMatch(cachePathRe);

    await reporter.close();
  });
}

addTest('https://github.com/ocaml/ocaml-re'); // git url with no .git
addTest('git+https://github.com/stevemao/left-pad.git#1.3.0'); // git+hash
addTest('https://github.com/stevemao/left-pad.git#1.3.0'); // hash
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
    const folder = path.join(cacheFolder, 'npm-@foo-bar', 'node_modules', '@foo', 'bar');
    await fs.mkdirp(folder);
    await fs.writeFile(
      path.join(folder, constants.METADATA_FILENAME),
      '{"remote": {"hash": "cafebabecafebabecafebabecafebabecafebabe"}}',
    );
    await fs.writeFile(path.join(folder, 'package.json'), '{"name": "@foo/bar", "version": "1.2.3"}');
  },
  true,
); // offline npm scoped package

test.concurrent('addPattern does not add duplicates', async () => {
  const {reporter, lockfile, config} = await createEnv({});
  const resolver = new PackageResolver(config, lockfile);
  resolver.addPattern('patternOne', {name: 'name'});
  resolver.addPattern('patternTwo', {name: 'name'});
  resolver.addPattern('patternOne', {name: 'name'});

  expect(resolver.patternsByPackage['name']).toEqual(['patternOne', 'patternTwo']);

  await reporter.close();
});
