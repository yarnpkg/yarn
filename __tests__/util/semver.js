/* @flow */

import {satisfiesWithPreleases} from '../../src/util/semver.js';

const semver = require('semver');

describe('satisfiesWithPreleases', () => {
  it('matches the behavior of node-semver for non-prerelease versions', () => {
    // true
    expect(satisfiesWithPreleases('2.0.0', '>=1.0.0')).toBe(semver.satisfies('2.0.0', '>=1.0.0'));
    expect(satisfiesWithPreleases('0.1.1', '^0.1.0')).toBe(semver.satisfies('0.1.1', '^0.1.0'));
    expect(satisfiesWithPreleases('1.0.1', '~1.0.0')).toBe(semver.satisfies('1.0.1', '~1.0.0'));

    // false
    expect(satisfiesWithPreleases('0.2.0', '^0.1.0')).toBe(semver.satisfies('0.2.0', '^0.1.0'));
    expect(satisfiesWithPreleases('1.1.0', '~1.0.0')).toBe(semver.satisfies('1.1.0', '~1.0.0'));
  });

  it('matches inexact prerelease versions', () => {
    expect(satisfiesWithPreleases('1.0.0-beta', '>=1.0.0-alpha')).toBe(true);
    expect(satisfiesWithPreleases('2.0.0-alpha', '>=1.0.0-beta')).toBe(true);
    expect(satisfiesWithPreleases('1.0.0-beta', '^1.0.0-alpha')).toBe(true);
    expect(satisfiesWithPreleases('1.0.0-alpha.2', '^1.0.0-alpha.1')).toBe(true);
    expect(satisfiesWithPreleases('1.0.0', '^1.0.0-alpha')).toBe(true);
    expect(satisfiesWithPreleases('1.0.0', '~1.0.0-alpha')).toBe(true);
    expect(satisfiesWithPreleases('1.0.1-alpha', '~1.0.0-alpha')).toBe(true);
    expect(satisfiesWithPreleases('1.1.0-alpha', '^1.0.0-alpha')).toBe(true);
    expect(satisfiesWithPreleases('1.1.0-alpha', '^1.0.0-beta')).toBe(true);
  });

  it('rejects prerelease versions that are too small', () => {
    expect(satisfiesWithPreleases('1.0.0-alpha', '^1.0.0')).toBe(false);
    expect(satisfiesWithPreleases('1.0.0-alpha', '>=1.0.0')).toBe(false);
    expect(satisfiesWithPreleases('1.0.0-alpha', '>=2.0.0-alpha')).toBe(false);
    expect(satisfiesWithPreleases('0.1.0-alpha', '^0.1.0')).toBe(false);
  });

  it('rejects prerelease versions that are too big', () => {
    expect(satisfiesWithPreleases('2.0.0-alpha', '^1.0.0')).toBe(false);
    expect(satisfiesWithPreleases('3.0.0-alpha', '^1.0.0')).toBe(false);
    expect(satisfiesWithPreleases('1.1.0-alpha', '~1.0.0')).toBe(false);
    expect(satisfiesWithPreleases('1.2.0-alpha', '~1.0.0')).toBe(false);
    expect(satisfiesWithPreleases('1.0.0-alpha.1', '1.0.0-alpha')).toBe(false);
  });

  it('follows the semver spec when comparing prerelease versions', () => {
    // Example from http://semver.org/#spec-item-11
    expect(satisfiesWithPreleases('1.0.0-alpha.1', '>1.0.0-alpha')).toBe(true);
    expect(satisfiesWithPreleases('1.0.0-alpha.beta', '>1.0.0-alpha.1')).toBe(true);
    expect(satisfiesWithPreleases('1.0.0-beta', '>1.0.0-alpha.beta')).toBe(true);
    expect(satisfiesWithPreleases('1.0.0-beta.2', '>1.0.0-beta')).toBe(true);
    expect(satisfiesWithPreleases('1.0.0-beta.11', '>1.0.0-beta.2')).toBe(true);
    expect(satisfiesWithPreleases('1.0.0-rc.1', '>1.0.0-beta.11')).toBe(true);
    expect(satisfiesWithPreleases('1.0.0', '>1.0.0-rc.1')).toBe(true);
  });
});
