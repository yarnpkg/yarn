/* @flow */

import semver from 'semver';
import {satisfiesWithPrereleases, diffWithUnstable} from '../../src/util/semver.js';

describe('satisfiesWithPrereleases', () => {
  it('matches the behavior of node-semver for non-prerelease versions', () => {
    // true
    expect(satisfiesWithPrereleases('2.0.0', '>=1.0.0')).toBe(semver.satisfies('2.0.0', '>=1.0.0'));
    expect(satisfiesWithPrereleases('0.1.1', '^0.1.0')).toBe(semver.satisfies('0.1.1', '^0.1.0'));
    expect(satisfiesWithPrereleases('1.0.1', '~1.0.0')).toBe(semver.satisfies('1.0.1', '~1.0.0'));

    // false
    expect(satisfiesWithPrereleases('0.2.0', '^0.1.0')).toBe(semver.satisfies('0.2.0', '^0.1.0'));
    expect(satisfiesWithPrereleases('1.1.0', '~1.0.0')).toBe(semver.satisfies('1.1.0', '~1.0.0'));
  });

  it('matches inexact prerelease versions', () => {
    expect(satisfiesWithPrereleases('1.0.0-beta', '>=1.0.0-alpha')).toBe(true);
    expect(satisfiesWithPrereleases('2.0.0-alpha', '>=1.0.0-beta')).toBe(true);
    expect(satisfiesWithPrereleases('1.0.0-beta', '^1.0.0-alpha')).toBe(true);
    expect(satisfiesWithPrereleases('1.0.0-alpha.2', '^1.0.0-alpha.1')).toBe(true);
    expect(satisfiesWithPrereleases('1.0.0', '^1.0.0-alpha')).toBe(true);
    expect(satisfiesWithPrereleases('1.0.0', '~1.0.0-alpha')).toBe(true);
    expect(satisfiesWithPrereleases('1.0.1-alpha', '~1.0.0-alpha')).toBe(true);
    expect(satisfiesWithPrereleases('1.1.0-alpha', '^1.0.0-alpha')).toBe(true);
    expect(satisfiesWithPrereleases('1.1.0-alpha', '^1.0.0-beta')).toBe(true);
  });

  it('rejects prerelease versions that are too small', () => {
    expect(satisfiesWithPrereleases('1.0.0-alpha', '^1.0.0')).toBe(false);
    expect(satisfiesWithPrereleases('1.0.0-alpha', '>=1.0.0')).toBe(false);
    expect(satisfiesWithPrereleases('1.0.0-alpha', '>=2.0.0-alpha')).toBe(false);
    expect(satisfiesWithPrereleases('0.1.0-alpha', '^0.1.0')).toBe(false);
  });

  it('rejects prerelease versions that are too big', () => {
    expect(satisfiesWithPrereleases('2.0.0-alpha', '^1.0.0')).toBe(false);
    expect(satisfiesWithPrereleases('3.0.0-alpha', '^1.0.0')).toBe(false);
    expect(satisfiesWithPrereleases('1.1.0-alpha', '~1.0.0')).toBe(false);
    expect(satisfiesWithPrereleases('1.2.0-alpha', '~1.0.0')).toBe(false);
    expect(satisfiesWithPrereleases('1.0.0-alpha.1', '1.0.0-alpha')).toBe(false);
  });

  it('rejects prerelease versions that are invalid', () => {
    expect(satisfiesWithPrereleases('1.0.0-alpha.01', '^1.0.0')).toBe(false);
  });

  it('follows the semver spec when comparing prerelease versions', () => {
    // Example from http://semver.org/#spec-item-11
    expect(satisfiesWithPrereleases('1.0.0-alpha.1', '>1.0.0-alpha')).toBe(true);
    expect(satisfiesWithPrereleases('1.0.0-alpha.beta', '>1.0.0-alpha.1')).toBe(true);
    expect(satisfiesWithPrereleases('1.0.0-beta', '>1.0.0-alpha.beta')).toBe(true);
    expect(satisfiesWithPrereleases('1.0.0-beta.2', '>1.0.0-beta')).toBe(true);
    expect(satisfiesWithPrereleases('1.0.0-beta.11', '>1.0.0-beta.2')).toBe(true);
    expect(satisfiesWithPrereleases('1.0.0-rc.1', '>1.0.0-beta.11')).toBe(true);
    expect(satisfiesWithPrereleases('1.0.0', '>1.0.0-rc.1')).toBe(true);
  });
});

describe('diffWithUnstable', () => {
  it('matches the behavior of node-semver for stable versions', () => {
    expect(diffWithUnstable('2.0.0', '1.0.0')).toBe(semver.diff('2.0.0', '1.0.0'));
    expect(diffWithUnstable('2.1.0', '2.0.0')).toBe(semver.diff('2.1.0', '2.0.0'));
    expect(diffWithUnstable('2.1.1', '2.1.0')).toBe(semver.diff('2.1.1', '2.1.0'));
    expect(diffWithUnstable('2.1.1-beta', '2.1.0')).toBe(semver.diff('2.1.1-beta', '2.1.0'));
    expect(diffWithUnstable('2.1.1-alpha', '2.1.1')).toBe(semver.diff('2.1.1-alpha', '2.1.1'));
    expect(diffWithUnstable('2.1.1', '2.1.1')).toBe(semver.diff('2.1.1', '2.1.1'));
    expect(diffWithUnstable('2.1.1-rc', '2.1.1-rc')).toBe(semver.diff('2.1.1-rc', '2.1.1-rc'));
  });

  it('treats patch and minor releases for pre-major versions as minor & major respectively', () => {
    expect(diffWithUnstable('0.2.0', '0.2.1')).toBe('minor');
    expect(diffWithUnstable('0.2.0', '0.2.1-rc')).toBe('preminor');
    expect(diffWithUnstable('0.1.0', '0.2.0')).toBe('major');
    expect(diffWithUnstable('0.1.0', '0.2.0-alpha')).toBe('premajor');
    expect(diffWithUnstable('0.2.1', '1.0.0')).toBe('major');
    expect(diffWithUnstable('0.2.1-rc', '1.0.0-beta')).toBe('premajor');
    expect(diffWithUnstable('0.2.2-rc.0', '0.2.2-rc.1')).toBe('prerelease');
  });

  it('treats patch and minor releases for pre-minor versions as major', () => {
    expect(diffWithUnstable('0.0.1', '0.0.2')).toBe('major');
    expect(diffWithUnstable('0.0.1', '0.0.2-rc')).toBe('premajor');
    expect(diffWithUnstable('0.0.2', '0.1.0')).toBe('major');
    expect(diffWithUnstable('0.0.2', '0.1.0-alpha')).toBe('premajor');
    expect(diffWithUnstable('0.0.2', '1.0.0')).toBe('major');
    expect(diffWithUnstable('0.0.2-rc', '1.0.0-beta')).toBe('premajor');
    expect(diffWithUnstable('0.0.2-rc.1', '0.0.2-rc.2')).toBe('prerelease');
  });

  it('returns null for equal versions', () => {
    expect(diffWithUnstable('1.0.0', '1.0.0')).toBeNull();
    expect(diffWithUnstable('2.0.1-beta.0', '2.0.1-beta.0')).toBeNull();
    expect(diffWithUnstable('0.2.1', '0.2.1')).toBeNull();
    expect(diffWithUnstable('0.2.3-alpha', '0.2.3-alpha')).toBeNull();
    expect(diffWithUnstable('0.0.11', '0.0.11')).toBeNull();
    expect(diffWithUnstable('0.0.100-beta.2', '0.0.100-beta.2')).toBeNull();
  });
});
