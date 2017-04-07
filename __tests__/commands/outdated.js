/* @flow */

import {run as buildRun} from './_helpers.js';
import {run as outdated} from '../../src/cli/commands/outdated.js';
import {ConsoleReporter, JSONReporter} from '../../src/reporters/index.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const semver = require('semver');
const stream = require('stream');
const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'outdated');
const runOutdated = buildRun.bind(
  null,
  // silence stderr
  class extends JSONReporter {
    constructor(opts: Object) {
      super({...opts, stderr: new stream.Writable({
        write() {},
      })});
    }
  },
  fixturesLoc,
  async (args, flags, config, reporter, lockfile, getStdout): Promise<string> => {
    await outdated(config, reporter, flags, args);
    return getStdout();
  },
);

test.concurrent('throws if lockfile is out of date', (): Promise<void> => {
  const reporter = new ConsoleReporter({});

  return new Promise(async (resolve) => {
    try {
      await runOutdated([], {}, 'lockfile-outdated');
    } catch (err) {
      expect(err.message).toContain(reporter.lang('lockfileOutdated'));
    } finally {
      resolve();
    }
  });
});

test.concurrent('no output when current matches latest', (): Promise<void> => {
  return runOutdated([], {}, 'current-is-latest', (config, reporter, out): ?Promise<void> => {
    expect(out).toBe('');
  });
});

test.concurrent('works with no arguments', (): Promise<void> => {
  return runOutdated([], {}, 'no-args', (config, reporter, out): ?Promise<void> => {
    const json: Object = JSON.parse(out);

    expect(json.data.body.length).toBe(1);
  });
});

test.concurrent('works with single argument', (): Promise<void> => {
  return runOutdated(['max-safe-integer'], {}, 'single-package', (config, reporter, out): ?Promise<void> => {
    const json: Object = JSON.parse(out);

    expect(json.data.body.length).toBe(1);
    expect(json.data.body[0][0]).toBe('max-safe-integer');
  });
});

test.concurrent('works with multiple arguments', (): Promise<void> => {
  return runOutdated(['left-pad', 'max-safe-integer'], {}, 'multiple-packages',
    (config, reporter, out): ?Promise<void> => {
      const json: Object = JSON.parse(out);

      expect(json.data.body.length).toBe(2);
      expect(json.data.body[0][0]).toBe('left-pad');
      expect(json.data.body[1][0]).toBe('max-safe-integer');
    },
  );
});

test.concurrent('works with exotic resolvers', (): Promise<void> => {
  return runOutdated([], {}, 'exotic-resolvers',
    (config, reporter, out): ?Promise<void> => {
      const json: Object = JSON.parse(out);
      const first = ['max-safe-integer', '1.0.1', 'exotic', 'exotic', 'dependencies',
        'https://github.com/sindresorhus/max-safe-integer.git'];
      const second = ['yarn', '0.16.2', 'exotic', 'exotic', 'dependencies', 'yarnpkg/yarn'];

      expect(json.data.body.length).toBe(2);
      expect(json.data.body[0]).toEqual(first);
      expect(json.data.body[1]).toEqual(second);
    },
  );
});

test.concurrent('hides when current > latest (next, beta tag)', (): Promise<void> => {
  return runOutdated([], {}, 'current-newer-than-latest',
    (config, reporter, out): ?Promise<void> => {
      expect(out).toBe('');
    },
  );
});

test.concurrent('shows when wanted > current and current > latest', (): Promise<void> => {
  return runOutdated([], {}, 'wanted-newer-than-current',
    (config, reporter, out): ?Promise<void> => {
      const json: Object = JSON.parse(out);

      expect(json.data.body.length).toBe(1);
      expect(json.data.body[0][0]).toBe('webpack');
      expect(semver.lt(json.data.body[0][1], json.data.body[0][2])).toBe(true);
    },
  );
});

test.concurrent('displays correct dependency types', (): Promise<void> => {
  return runOutdated([], {}, 'display-dependency-type',
    (config, reporter, out): ?Promise<void> => {
      const json: Object = JSON.parse(out);
      const {body} = json.data;

      // peerDependencies aren't included in the output
      expect(json.data.body.length).toBe(3);
      expect(body[0][0]).toBe('is-online');
      expect(body[0][4]).toBe('optionalDependencies');
      expect(body[1][0]).toBe('left-pad');
      expect(body[1][4]).toBe('dependencies');
      expect(body[2][0]).toBe('max-safe-integer');
      expect(body[2][4]).toBe('devDependencies');
    },
  );
});
