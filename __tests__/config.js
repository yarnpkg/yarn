/* @flow */

import Config, {extractWorkspaces} from '../src/config.js';
import {ConsoleReporter, BufferReporter} from '../src/reporters/index.js';
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
      private: true,
      workspaces,
    };

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
    expect(config.getWorkspaces(manifest)).toBeUndefined();

    config.workspacesEnabled = true;
    const ws = config.getWorkspaces(manifest);
    if (!ws) {
      expect(ws).not.toBeUndefined();
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
  test('workspaces is eligible only for private packages', async () => {
    const config = await initConfig({});
    const packages = ['w1', 'w2'];
    const nohoist = ['a'];
    const manifest = createWorkspaceManifest(packages, nohoist);
    config.workspacesEnabled = true;
    expect(config.getWorkspaces(manifest)).not.toBeUndefined();

    manifest.private = false;
    expect(config.getWorkspaces(manifest)).toBeUndefined();
  });
  test('nohoist is eligible only for private packages and workspacesNohoistEnabled', async () => {
    const config = await initConfig({});
    const packages = ['w1', 'w2'];
    const nohoist = ['a'];
    const manifest = createWorkspaceManifest(packages, nohoist);

    // any one of these flag would turn off nohoist
    function testNohoistEligibility(isPrivate: boolean, workspacesNohoistEnabled: boolean, expectEligibility: boolean) {
      manifest.private = isPrivate;
      config.workspacesNohoistEnabled = workspacesNohoistEnabled;
      const ws = config.getWorkspaces(manifest);
      if (ws) {
        if (!expectEligibility) {
          expect(ws.nohoist).toBeUndefined();
        } else {
          expect(ws.nohoist).toEqual(nohoist);
        }
      } else {
        if (expectEligibility) {
          expect(ws).not.toBeUndefined();
        }
      }
    }

    testNohoistEligibility(true, false, false);
    testNohoistEligibility(false, true, false);
    testNohoistEligibility(true, true, true);
  });
  test('can throw exception for eligibility violation', async () => {
    const config = await initConfig({});
    const packages = ['w1', 'w2'];
    const nohoist = ['a'];
    const manifest = createWorkspaceManifest(packages, nohoist);

    manifest.private = false;
    const ws = config.getWorkspaces(manifest);
    expect(ws).toBeUndefined();

    try {
      config.getWorkspaces(manifest, true);
      expect(`exception to be thrown`).toEqual('but it did not...');
    } catch (e) {
      // ok
    }

    // should not thrown if manifest is eligible
    manifest.private = true;
    expect(config.getWorkspaces(manifest, true)).not.toBeUndefined();
  });
  test('can report eligibility warnings', async () => {
    const config = await initConfig({});
    const nohoist = ['a'];
    const manifest = createWorkspaceManifest([], nohoist);

    function getNohoist(ws: ?WorkspacesConfig): ?Array<string> {
      return ws ? ws.nohoist : undefined;
    }

    const mockReporter = new MockReporter();
    config.reporter = mockReporter;

    // when everything is fine, reporter should be empty
    expect(getNohoist(config.getWorkspaces(manifest, false))).not.toBeUndefined();
    expect(mockReporter.numberOfCalls()).toEqual(0);

    config.workspacesNohoistEnabled = false;
    expect(getNohoist(config.getWorkspaces(manifest, false))).toBeUndefined();
    expect(mockReporter.numberOfCalls()).toEqual(1);
    expect(mockReporter.findCalls('workspacesNohoistDisabled').length).toEqual(1);

    mockReporter.reset();

    config.workspacesNohoistEnabled = true;
    manifest.private = false;
    expect(getNohoist(config.getWorkspaces(manifest, false))).toBeUndefined();
    expect(mockReporter.numberOfCalls()).toEqual(1);
    expect(mockReporter.findCalls('workspacesNohoistRequirePrivatePackages').length).toEqual(1);
  });
});

class MockReporter extends BufferReporter {
  lang = jest.fn();

  findCalls(key: string): Array<Array<any>> {
    return this.lang.mock.calls.filter(call => {
      return call[0] === key;
    });
  }
  numberOfCalls(): number {
    return this.lang.mock.calls.length;
  }
  reset() {
    this.lang.mockReset();
  }
}
