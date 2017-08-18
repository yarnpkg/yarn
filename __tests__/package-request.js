/* @flow */

import PackageRequest from '../src/package-request.js';
import * as reporters from '../src/reporters/index.js';
import PackageResolver from '../src/package-resolver.js';
import Lockfile from '../src/lockfile';
import Config from '../src/config.js';

async function prepareRequest(pattern, version, resolved): Object {
  const privateDepCache = {[pattern]: {version, resolved}};
  const lockfile = new Lockfile({cache: privateDepCache});
  const reporter = new reporters.NoopReporter({});
  const depRequestPattern = {
    pattern,
    registry: 'npm',
    hint: null,
    optional: false,
  };
  const config = await Config.create({}, reporter);
  const resolver = new PackageResolver(config, lockfile);
  const request = new PackageRequest(depRequestPattern, resolver);

  return {request, reporter};
}

test('Produce valid remote type for a git private dep', async () => {
  const {request, reporter} = await prepareRequest(
    'private-dep@github:yarnpkg/private-dep#1.0.0',
    '1.0.0',
    'git+ssh://git@github.com/yarnpkg/private-dep.git#d6c57894210c52be02da7859dbb5205feb85d8b0',
  );

  expect(request.getLocked('git')._remote.type).toBe('git');
  expect(request.getLocked('tarball')._remote.type).toBe('git');

  await reporter.close();
});

test('Produce valid remote type for a git public dep', async () => {
  const {request, reporter} = await prepareRequest(
    'public-dep@yarnpkg/public-dep#1fde368',
    '1.0.0',
    'https://codeload.github.com/yarnpkg/public-dep/tar.gz/1fde368',
  );

  expect(request.getLocked('git')._remote.type).toBe('git');
  expect(request.getLocked('tarball')._remote.type).toBe('tarball');

  await reporter.close();
});
