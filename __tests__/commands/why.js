/* @flow */

import {BufferReporter} from '../../src/reporters/index.js';
import {run as why, queryWhy} from '../../src/cli/commands/why.js';
import * as reporters from '../../src/reporters/index.js';
import Config from '../../src/config.js';
import path from 'path';
import {HoistManifest} from '../../src/package-hoister.js';
import type {Manifest} from '../../src/types.js';
import type {HoistManifestTuple, HoistManifestTuples} from '../../src/package-hoister.js';
import type {LanguageKeys} from '../../src/reporters/lang/en.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'why');

async function runWhy(
  flags: Object,
  args: Array<string>,
  name: string,
  checkSteps?: ?(config: Config, reporter: BufferReporter) => ?Promise<void>,
  _reporter?: reporters.BufferReporter,
): Promise<void> {
  const cwd = path.join(fixturesLoc, name);
  const reporter = _reporter || new reporters.BufferReporter({stdout: null, stdin: null});

  try {
    const config = await Config.create({cwd}, reporter);
    await why(config, reporter, flags, args);

    if (checkSteps) {
      await checkSteps(config, reporter);
    }
  } catch (err) {
    throw new Error(`${err && err.stack}`);
  }
}

test.concurrent('throws error with no arguments', (): Promise<void> => {
  const reporter = new reporters.ConsoleReporter({});

  return new Promise(async (resolve): Promise<void> => {
    try {
      await runWhy({}, [], 'basic');
    } catch (err) {
      expect(err.message).toContain(reporter.lang('missingWhyDependency'));
    } finally {
      resolve();
    }
  });
});

test.concurrent('throws error with too many arguments', (): Promise<void> => {
  const reporter = new reporters.ConsoleReporter({});

  return new Promise(async (resolve): Promise<void> => {
    try {
      await runWhy({}, ['one', 'two'], 'basic');
    } catch (err) {
      expect(err.message).toContain(reporter.lang('tooManyArguments', 1));
    } finally {
      resolve();
    }
  });
});

test.concurrent("doesn't throw when using it inside a workspace", (): Promise<void> => {
  return runWhy({}, ['mime-types'], 'workspace');
});

test.concurrent('throws error if module does not exist', (): Promise<void> => {
  const reporter = new reporters.ConsoleReporter({});

  return new Promise(async (resolve): Promise<void> => {
    try {
      await runWhy({}, ['one'], 'basic');
    } catch (err) {
      expect(err.message).toContain(reporter.lang('whyUnknownMatch'));
    } finally {
      resolve();
    }
  });
});

test.concurrent('should determine that the module installed because it is in dependencies', (): Promise<void> => {
  return runWhy({}, ['mime-types'], 'basic', (config, reporter) => {
    const report = reporter.getBuffer();
    expect(report[report.length - 1].data).toEqual(reporter.lang('whySpecifiedSimple', 'dependencies'));
  });
});

test.concurrent('should determine that the module installed because it is in devDependencies', (): Promise<void> => {
  return runWhy({}, ['left-pad'], 'basic', (config, reporter) => {
    const report = reporter.getBuffer();
    expect(report[report.length - 1].data).toEqual(reporter.lang('whySpecifiedSimple', 'devDependencies'));
  });
});

test.concurrent('should determine that the module installed because mime-types depend on it', (): Promise<void> => {
  return runWhy({}, ['mime-db'], 'basic', (config, reporter) => {
    const report = reporter.getBuffer();
    expect((report[report.length - 1].data: any).items).toContainEqual(reporter.lang('whyDependedOn', 'mime-types'));
  });
});

test.concurrent('should determine that the module installed because it is hoisted from glob depend on it', (): Promise<
  void,
> => {
  return runWhy({}, ['glob#minimatch'], 'basic', (config, reporter) => {
    const report = reporter.getBuffer();
    expect(report[report.length - 2].data).toEqual(reporter.lang('whyHoistedTo', 'glob#minimatch'));
  });
});

test('should report when a module is included multiple times including the root', (): Promise<void> => {
  return runWhy({}, ['caniuse-lite'], 'dep-included-at-2-levels', (config, reporter) => {
    const report = reporter.getBuffer();
    const reasons = report
      .filter(entry => entry.type === 'list' && entry.data.type === 'reasons')
      .map(entry => entry.data.items)[0];

    expect(reasons).toEqual([
      'Specified in "dependencies"',
      'Hoisted from "b#caniuse-api#caniuse-lite"',
      'Hoisted from "b#caniuse-api#browserslist#caniuse-lite"',
    ]);
  });
});

class MockReporter extends reporters.BufferReporter {
  _lang = jest.fn();
  lang(key: LanguageKeys, ...args: Array<mixed>): string {
    this._lang(key, args);
    return super.lang(key, args);
  }

  findCalls(key: string): Array<Array<any>> {
    return this._lang.mock.calls.filter(call => {
      return call[0] === key;
    });
  }
}

describe('reports multiple occurrences', () => {
  function setupTest(
    target: string,
    checkSteps: (config: Config, reporter: MockReporter) => ?Promise<void>,
  ): Promise<void> {
    const _reporter = new MockReporter({stdout: null, stdin: null});
    return runWhy(
      {includeWorkspaceDeps: true},
      [target],
      'workspaces-nohoist',
      (config, reporter) => checkSteps(config, _reporter),
      _reporter,
    );
  }
  test.concurrent('due to nohoist', (): Promise<void> => {
    const target = 'mime-types';
    return setupTest(target, (config, reporter) => {
      // check packages matched
      let calls = reporter.findCalls('whyMatch');
      expect(calls.length).toEqual(2);

      const found: [boolean, boolean] = [false, false];
      calls.forEach(call => {
        const pkg: string = call[1][0];
        if (pkg.indexOf(target) === 0) {
          found[0] = true;
        } else if (pkg.indexOf(`#${target}`) > 0) {
          found[1] = true;
        }
      });
      expect(found[0]).toEqual(true);
      expect(found[1]).toEqual(true);

      // check reasons: should have both hoist and nohoist
      calls = reporter.findCalls('whyHoistedTo');
      expect(calls.length).toEqual(1);
      expect(calls[0][1][0]).toEqual(target);

      calls = reporter.findCalls('whyNotHoisted');
      expect(calls.length).toEqual(1);
      const nohoistList = calls[0][1][0];
      let found2 = false;
      for (const p of nohoistList) {
        if (p.indexOf(target) >= 0) {
          found2 = true;
          break;
        }
      }
      expect(found2).toBeTruthy();
    });
  });
  test.concurrent('due to version conflict', (): Promise<void> => {
    const target = 'uglifyify';
    return setupTest(target, (config, reporter) => {
      // check packages matched
      let calls = reporter.findCalls('whyMatch');
      expect(calls.length).toEqual(2);

      const found: [boolean, boolean] = [false, false];
      calls.forEach(call => {
        const pkg: string = call[1][0];
        if (pkg.indexOf(target) === 0) {
          found[0] = true;
        } else if (pkg.indexOf(`#${target}`) > 0) {
          found[1] = true;
        }
      });
      expect(found[0]).toEqual(true);
      expect(found[1]).toEqual(true);

      // check reasons: should have both hoist and nohoist
      calls = reporter.findCalls('whySpecified');
      expect(calls.length).toEqual(2);
    });
  });
});

describe('queryWhy', () => {
  function mockManifest(name: string): Manifest {
    return {
      name,
      version: '1.0.0',
      _uid: '',
    };
  }

  function mockHoistManifestTuple(name: string, key: string, previousPaths: Array<?string>): HoistManifestTuple {
    const hm = new HoistManifest(key, [], mockManifest(name), '', false, true, false);
    return ['', hm];
  }

  function validateMatch(matches: Array<HoistManifestTuple>, expected: Array<string>) {
    expect(matches.length).toEqual(expected.length);
    for (let i = 0; i < matches.length; i++) {
      expect(matches[i][1].key).toEqual(expected[i]);
    }
  }

  test('can determine a nohoist module', () => {
    const hoisted: HoistManifestTuples = [
      mockHoistManifestTuple('b', 'b', ['workspace-1#b']),
      mockHoistManifestTuple('a', 'workspace-1#a', []),
    ];
    validateMatch(queryWhy('a', hoisted), ['workspace-1#a']);
    validateMatch(queryWhy('b', hoisted), ['b']);
  });
  test('can determine a deep nohoist module', () => {
    const hoisted: HoistManifestTuples = [
      mockHoistManifestTuple('b', 'b', ['workspace-1#b']),
      mockHoistManifestTuple('c', 'workspace-1#a#c', []),
      mockHoistManifestTuple('a', 'workspace-1#a', []),
    ];
    validateMatch(queryWhy('a', hoisted), ['workspace-1#a']);
    validateMatch(queryWhy('c', hoisted), ['workspace-1#a#c']);
    validateMatch(queryWhy('a#c', hoisted), ['workspace-1#a#c']);
  });
  test('can return multiple matches', () => {
    const hoisted: HoistManifestTuples = [
      mockHoistManifestTuple('b', 'b', ['workspace-1#b']),
      mockHoistManifestTuple('b', 'c#b', []),
      mockHoistManifestTuple('a', 'workspace-1#a', []),
      mockHoistManifestTuple('c', 'c', ['workspace-1#c']),
    ];
    validateMatch(queryWhy('b', hoisted), ['b', 'c#b']);
  });
});
