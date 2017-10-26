/* @flow */

import Config from '../src/config.js';
import {ConsoleReporter} from '../src/reporters/index.js';

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
