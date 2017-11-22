/* @flow */

import Config, {extractWorkspaces} from '../src/config.js';
import {ConsoleReporter} from '../src/reporters/index.js';
import type {WorkspacesConfig, Manifest} from '../src/types.js';

const stream = require('stream');

const initConfig = async cfg => {
  const stdout = new stream.Writable({
    decodeStrings: false,
    write(data, encoding, cb) {
      cb();
    },
  });

  const reporter = new ConsoleReporter({stdout, stderr: stdout});
  const config = new Config(reporter);
  await config.init(cfg);
  return config;
};

test('getOption changes ~ to cwd when resolve=true', async () => {
  const config = await initConfig({});
  config.registries.yarn.config.cafile = '~/';
  expect(config.getOption('cafile', true)).not.toContain('~');
});

test('getOption does not change ~ when resolve=false', async () => {
  const config = await initConfig({});
  config.registries.yarn.config.cafile = '~/';
  expect(config.getOption('cafile', false)).toEqual('~/');
});

test('getOption does not change empty-string when resolve=true', async () => {
  const config = await initConfig({});
  config.registries.yarn.config.cafile = '';
  expect(config.getOption('cafile', true)).toEqual('');
});

test('getOption does not change empty-string when resolve=false', async () => {
  const config = await initConfig({});
  config.registries.yarn.config.cafile = '';
  expect(config.getOption('cafile', false)).toEqual('');
});

describe('workspaces config', () => {
  function createWorkspaceManifest(packages: Array<string>, nohoist: Array<string>): Manifest {
    const workspaces: WorkspacesConfig = {
      packages,
      nohoist,
    };
    const manifest: Manifest = {
      _uid: 'whatever',
      version: '1.0',
      name: 'whatever',
    };
    manifest.workspaces = workspaces;

    return manifest;
  }
  function validateWS(expected: ?WorkspacesConfig, actual: ?WorkspacesConfig) {
    if (!expected) {
      expect(actual).toBeUndefined();
      return;
    }
    if (!actual) {
      expect(actual).not.toBeUndefined();
      return;
    }

    expect(actual.packages).toEqual(expected.packages);
    expect(actual.nohoist).toEqual(expected.nohoist);
  }

  test('accessing workspaces config requires explicit enabling', async () => {
    const config = await initConfig({});
    const packages = ['w1', 'w2'];
    const nohoist = ['a'];
    const manifest = createWorkspaceManifest(packages, nohoist);
    config.workspacesEnabled = false;
    expect(config.getWorkspaces(manifest)).toBeFalsy();

    config.workspacesEnabled = true;
    const ws = config.getWorkspaces(manifest);
    if (!ws) {
      expect(ws).not.toBeFalsy();
    } else {
      expect(ws.packages).toEqual(packages);
      expect(ws.nohoist).toEqual(nohoist);
    }
  });
  test('can adapt legacy workspaces to new format', () => {
    const packages = ['w1', 'w2'];
    const nohoist = ['a'];
    const manifest = createWorkspaceManifest(packages, nohoist);

    const expected: WorkspacesConfig = {
      packages,
      nohoist,
    };

    // manifest.workspaces = newWorkspaces;
    validateWS(expected, extractWorkspaces(manifest));

    manifest.workspaces = packages;
    expected.nohoist = undefined;
    validateWS(expected, extractWorkspaces(manifest));

    manifest.workspaces = undefined;
    validateWS(undefined, extractWorkspaces(manifest));

    manifest.workspaces = {};
    validateWS(undefined, extractWorkspaces(manifest));
  });
});
