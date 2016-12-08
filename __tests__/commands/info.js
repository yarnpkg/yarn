/* @flow */

import {run as info} from '../../src/cli/commands/info.js';
import {BufferReporter} from '../../src/reporters/index.js';
import Config from '../../src/config.js';
import path from 'path';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'info');

async function runInfo(
  args: Array<string>,
  flags: Object,
  name: string,
  checkSteps?: ?(config: Config, output: any) => ?Promise<void>,
): Promise<void> {
  const reporter = new BufferReporter({stdout: null, stdin: null});
  const config = new Config(reporter);
  const cwd = name && path.join(fixturesLoc, name);
  await config.init({cwd});
  await info(config, reporter, flags, args);

  if (checkSteps) {
    const buffer = reporter.getBuffer();
    const output = buffer.pop().data;
    await checkSteps(config, output);
  }
}

const expectedKeys = [
  'name',
  'maintainers',
  'dist-tags',
  'description',
  'version',
  'versions',
  'homepage',
  'repository',
  'bugs',
  'license',
  'scripts',
  'dependencies',
  'devDependencies',
  'dist',
  'directories',
];

test.concurrent('without arguments and in directory containing a valid package file', (): Promise<void> => {
  return runInfo(['.'], {}, 'local',
    (config, output): ?Promise<void> => {
      const actualKeys = Object.keys(output);
      expectedKeys.forEach((key) => expect(actualKeys).toContain(key));
      expect(output.name).toEqual('yarn');
    },
  );
});

test.concurrent('with first argument "." and in directory containing a valid package file', (): Promise<void> => {
  return runInfo(['.'], {}, 'local',
    (config, output): ?Promise<void> => {
      const actualKeys = Object.keys(output);
      expectedKeys.forEach((key) => expect(actualKeys).toContain(key));
      expect(output.name).toEqual('yarn');
    },
  );
});

test.concurrent('with one argument shows info about the package with specified name', (): Promise<void> => {
  return runInfo(['yarn'], {}, 'local',
    (config, output): ?Promise<void> => {
      const actualKeys = Object.keys(output);
      expectedKeys.forEach((key) => expect(actualKeys).toContain(key));
      expect(output.name).toEqual('yarn');
    },
  );
});

test.concurrent('with one argument does not contain readme field', (): Promise<void> => {
  return runInfo(['yarn'], {}, '',
    (config, output): ?Promise<void> => {
      expect(output.readme).toBe(undefined);
    },
  );
});

test.concurrent('with two arguments and second argument "readme" shows readme string', (): Promise<void> => {
  return runInfo(['yarn', 'readme'], {}, '',
    (config, output): ?Promise<void> => {
      expect(typeof output).toBe('string');
      expect(output).toMatch(/Installing\sYarn/);
    },
  );
});

test.concurrent('with two arguments and second argument as a simple field', (): Promise<void> => {
  return runInfo(['yarn', 'repository'], {}, '',
    (config, output): ?Promise<void> => {
      expect(output).toEqual({
        type: 'git',
        url: 'git+https://github.com/yarnpkg/yarn.git',
      });
    },
  );
});

test.concurrent('with two arguments and second argument as "."-separated field path', (): Promise<void> => {
  return runInfo(['yarn', 'repository.type'], {}, '',
    (config, output): ?Promise<void> => {
      expect(output).toEqual('git');
    },
  );
});

test.concurrent('with two arguments and second argument as a non-existing field', (): Promise<void> => {
  return runInfo(['yarn', 'unknown'], {}, '',
    (config, output): ?Promise<void> => {
      expect(output).toBe(undefined);
    },
  );
});

test.concurrent('with two arguments and second argument path containing non-existing field', (): Promise<void> => {
  return runInfo(['yarn', 'repository.unknown.type'], {}, '',
    (config, output): ?Promise<void> => {
      expect(output).toBe(undefined);
    },
  );
});
