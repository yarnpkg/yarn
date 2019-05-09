/* @flow */
import {run as buildRun, explodeLockfile} from './_helpers.js';
import {BufferReporter} from '../../src/reporters/index.js';
import {run as resolveMerge} from '../../src/cli/commands/resolve-merge.js';
import path from 'path';
import * as fs from '../../src/util/fs.js';

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'resolve-merge');
const runResolveMerge = buildRun.bind(null, BufferReporter, fixturesLoc, (args, flags, config, reporter) => {
  config.commandName = 'resolve-merge';
  return resolveMerge(config, reporter, flags, args);
});

describe('resolve-merge', () => {
  test.concurrent('throws if lockfile is missing', async () => {
    const reporter = new BufferReporter({});
    let thrown = false;
    try {
      await runResolveMerge([], {}, 'missing-lockfile');
    } catch (err) {
      thrown = true;
      expect(err.message).toContain(reporter.lang('mergeLockfileMissing'));
    }
    expect(thrown).toBe(true);
  });

  test.concurrent('throws for conflict that cannot be resolved', async () => {
    const reporter = new BufferReporter({});
    let thrown = false;
    try {
      await runResolveMerge([], {}, 'unresolved-conflict');
    } catch (err) {
      thrown = true;
      expect(err.message).toContain(reporter.lang('mergeLockfileUnresolvedConflict'));
    }
    expect(thrown).toBe(true);
  });

  test.concurrent('returns if there are no conflicts to resolve', () => {
    return runResolveMerge([], {}, 'no-conflict', (config, reporter): ?Promise<void> => {
      const buffer = reporter.getBuffer();
      expect(reporter.getBuffer()[buffer.length - 1].data).toContain(reporter.lang('mergeLockfileNoConflict'));
    });
  });

  test.concurrent('resolves a conflict', async () => {
    await runResolveMerge([], {}, 'resolve-conflict', async (config, reporter) => {
      const lockfile = explodeLockfile(await fs.readFile(path.join(config.cwd, 'yarn.lock')));
      expect(lockfile).toHaveLength(6);
      expect(lockfile.indexOf('foo@^1.0.0:')).toEqual(0);
      expect(lockfile.indexOf('left-pad@^1.1.2:')).toEqual(3);
      expect(lockfile).not.toContain('left-pad@^1.1.1:');

      const buffer = reporter.getBuffer();
      expect(buffer[buffer.length - 1].data).toContain(reporter.lang('savedLockfile'));
    });
  });
});
