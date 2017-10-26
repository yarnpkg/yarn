/* @flow */

import PackageRequest from '../src/package-request.js';
import * as reporters from '../src/reporters/index.js';
import PackageResolver from '../src/package-resolver.js';
import Lockfile from '../src/lockfile';
import Config from '../src/config.js';

async function prepareRequest(pattern: string, version: string, resolved: string, parentRequest?: Object): Object {
  const privateDepCache = {[pattern]: {version, resolved}};
  const reporter = new reporters.NoopReporter({});
  const depRequestPattern = {
    pattern,
    registry: 'npm',
    hint: null,
    optional: false,
    parentNames: [],
    parentRequest,
  };
  if (parentRequest) {
    depRequestPattern.parentRequest = parentRequest;
    depRequestPattern.parentNames = [...parentRequest.parentNames, parentRequest.pattern];

    const lock = parentRequest.getLocked();
    privateDepCache[parentRequest.pattern] = {version: lock.version, resolved: lock._remote.resolved};
  }
  const lockfile = new Lockfile({cache: privateDepCache});
  const config = await Config.create({}, reporter);
  const resolver = new PackageResolver(config, lockfile);
  const request = new PackageRequest(depRequestPattern, resolver);

  return {request, reporter};
}

test('Produce valid remote type for a git-over-ssh dep', async () => {
  const {request, reporter} = await prepareRequest(
    'private-dep@github:yarnpkg/private-dep#1.0.0',
    '1.0.0',
    'git+ssh://git@github.com/yarnpkg/private-dep.git#d6c57894210c52be02da7859dbb5205feb85d8b0',
  );

  expect(request.getLocked('git')._remote.type).toBe('git');
  expect(request.getLocked('tarball')._remote.type).toBe('git');

  await reporter.close();
});

test('Produce valid remote type for a git-over-https dep', async () => {
  const {request, reporter} = await prepareRequest(
    'public-dep@yarnpkg/public-dep#1.0.0',
    '1.0.0',
    'git+https://github.com/yarnpkg/public-dep#1fde368',
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

test('Check parentNames flowing in the request', async () => {
  const {request: parentRequest, reporter: parentReporter} = await prepareRequest(
    'parent@1.0.0',
    '1.0.0',
    'git+ssh://git@github.com/yarnpkg/parent.git',
  );
  expect(parentRequest).not.toBeNull();
  const {request: childRequest, reporter: childReporter} = await prepareRequest(
    'child@1.0.0',
    '1.0.0',
    'git+ssh://git@github.com/yarnpkg/child.git',
    parentRequest,
  );

  expect(childRequest.parentNames).toContain(parentRequest.pattern);
  await parentReporter.close();
  await childReporter.close();
});
