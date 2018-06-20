/* @flow */

import WorkspaceLayout from '../src/workspace-layout.js';
import Config from '../src/config.js';
import NoopReporter from '../src/reporters/noop-reporter';
import type {WorkspacesManifestMap} from '../src/types';

const workspaceMap: WorkspacesManifestMap = Object.freeze({
  pkgA: {
    loc: './pkgA',
    manifest: {
      _uid: '1',
      name: 'pkgA',
      version: '1.2.3',
    },
  },
  '@yarn/pkgB': {
    loc: './pkgB',
    manifest: {
      _uid: '1',
      name: '@yarn/pkgB',
      version: '1.2.3',
    },
  },
});

describe('WorkspaceLayout.getManifestByPattern()', () => {
  test('returns null when workspace does not contain a package with requested name', () => {
    const layout = new WorkspaceLayout(workspaceMap, new Config(new NoopReporter()));
    const result = layout.getManifestByPattern('does-not-exist');
    expect(result).toBe(null);
  });

  test('returns null when workspace contains a package with requested name but version does not match', () => {
    const layout = new WorkspaceLayout(workspaceMap, new Config(new NoopReporter()));
    const result = layout.getManifestByPattern('pkgA@^9.0.0');
    expect(result).toBe(null);
  });

  test('returns manifest when workspace contains a package with requested name and version matches', () => {
    const layout = new WorkspaceLayout(workspaceMap, new Config(new NoopReporter()));
    const result = layout.getManifestByPattern('pkgA@^1.0.0');
    expect(result).toBe(workspaceMap.pkgA);
  });

  test('returns null when workspace contains a package with requested name and version is not a semver range', () => {
    const layout = new WorkspaceLayout(workspaceMap, new Config(new NoopReporter()));
    const result = layout.getManifestByPattern('pkgA@git+https://git@github.com/yarnpkg/test-package.git');
    expect(result).toBe(workspaceMap.pkgA);
  });

  test('returns manifest when workspace contains a scoped package with requested name and version matches', () => {
    const layout = new WorkspaceLayout(workspaceMap, new Config(new NoopReporter()));
    const result = layout.getManifestByPattern('@yarn/pkgB@^1.0.0');
    expect(result).toBe(workspaceMap['@yarn/pkgB']);
  });
});
