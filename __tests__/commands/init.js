/* @flow */

import type {QuestionOptions} from '../../src/reporters/types.js';
import {ConsoleReporter} from '../../src/reporters/index.js';
import {run as buildRun} from './_helpers.js';
import {getGitConfigInfo, run as runInit} from '../../src/cli/commands/init.js';
import * as fs from '../../src/util/fs.js';

const path = require('path');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'init');

test.concurrent('init --yes should create package.json with defaults', (): Promise<void> => {
  return buildRun(
    ConsoleReporter,
    fixturesLoc,
    (args, flags, config, reporter, lockfile): Promise<void> => {
      return runInit(config, reporter, flags, args);
    },
    [],
    {yes: true},
    'init-yes',
    async (config): Promise<void> => {
      const {cwd} = config;
      const manifestFile = await fs.readFile(path.join(cwd, 'package.json'));
      const manifest = JSON.parse(manifestFile);

      // Name is derived from directory name which is dynamic so check
      // that separately and then remove from snapshot
      expect(manifest.name).toEqual(path.basename(cwd));
      expect(manifest.private).toEqual(undefined);
      expect({...manifest, name: 'init-yes'}).toMatchSnapshot('init-yes');
    },
  );
});

test.concurrent('init --yes --private should create package.json with defaults and private true', (): Promise<void> => {
  return buildRun(
    ConsoleReporter,
    fixturesLoc,
    (args, flags, config, reporter, lockfile): Promise<void> => {
      return runInit(config, reporter, flags, args);
    },
    [],
    {yes: true, private: true},
    'init-yes-private',
    async (config): Promise<void> => {
      const {cwd} = config;
      const manifestFile = await fs.readFile(path.join(cwd, 'package.json'));
      const manifest = JSON.parse(manifestFile);

      // Name is derived from directory name which is dynamic so check
      // that separately and then remove from snapshot
      expect(manifest.name).toEqual(path.basename(cwd));
      expect(manifest.private).toEqual(true);
      expect({...manifest, name: 'init-yes-private'}).toMatchSnapshot('init-yes-private');
    },
  );
});

test.concurrent('init using Github shorthand should resolve to full repository URL', (): Promise<void> => {
  const questionMap = Object.freeze({
    name: 'hi-github',
    version: '',
    description: '',
    'entry point': '',
    'repository url': 'user/repo',
    author: '',
    license: '',
    private: 'false',
  });
  class TestReporter extends ConsoleReporter {
    question(question: string, options?: QuestionOptions = {}): Promise<string> {
      return new Promise((resolve, reject) => {
        const parsedQuestion = question.replace(/ \((.*?)\)/g, '');
        if (parsedQuestion in questionMap) {
          resolve(questionMap[parsedQuestion]);
        } else {
          reject(new Error(`Question not found in question-answer map ${parsedQuestion}`));
        }
      });
    }
  }

  return buildRun(
    TestReporter,
    fixturesLoc,
    (args, flags, config, reporter, lockfile): Promise<void> => {
      return runInit(config, reporter, flags, args);
    },
    [],
    {},
    'init-github',
    async (config): Promise<void> => {
      const manifestFile = await fs.readFile(path.join(config.cwd, 'package.json'));

      expect(JSON.parse(manifestFile)).toMatchSnapshot('init-github');
    },
  );
});

test.concurrent('init and give private empty', (): Promise<void> => {
  const questionMap = Object.freeze({
    name: 'private-empty',
    version: '',
    description: '',
    'entry point': '',
    'repository url': '',
    author: '',
    license: '',
    private: '',
  });
  class TestReporter extends ConsoleReporter {
    question(question: string, options?: QuestionOptions = {}): Promise<string> {
      return new Promise((resolve, reject) => {
        const parsedQuestion = question.replace(/ \((.*?)\)/g, '');
        if (parsedQuestion in questionMap) {
          resolve(questionMap[parsedQuestion]);
        } else {
          reject(new Error(`Question not found in question-answer map ${parsedQuestion}`));
        }
      });
    }
  }

  return buildRun(
    TestReporter,
    fixturesLoc,
    (args, flags, config, reporter, lockfile): Promise<void> => {
      return runInit(config, reporter, flags, args);
    },
    [],
    {},
    'init-github',
    async (config): Promise<void> => {
      const manifestFile = await fs.readFile(path.join(config.cwd, 'package.json'));
      expect(JSON.parse(manifestFile)).toMatchSnapshot('init-private-empty');
    },
  );
});

test.concurrent('getGitConfigInfo should not return the git config val', async (): Promise<void> => {
  expect('hi seb').toEqual(await getGitConfigInfo('some-info', () => Promise.resolve('hi seb')));
});

test.concurrent('getGitConfigInfo should not fail when git fails', async (): Promise<void> => {
  expect('').toEqual(await getGitConfigInfo('some-info', () => Promise.reject(Error())));
});
