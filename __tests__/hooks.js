/* @flow */

import {runInstall} from './commands/_helpers.js';

test('install should call the resolveStep hook', async () => {
  global.experimentalYarnHooks = {
    resolveStep: jest.fn(cb => cb()),
  };
  await runInstall({}, 'install-production', config => {
    expect(global.experimentalYarnHooks.resolveStep.mock.calls.length).toEqual(1);
  });
  delete global.experimentalYarnHooks;
});

test('install should call the fetchStep hook', async () => {
  global.experimentalYarnHooks = {
    fetchStep: jest.fn(cb => cb()),
  };
  await runInstall({}, 'install-production', config => {
    expect(global.experimentalYarnHooks.fetchStep.mock.calls.length).toEqual(1);
  });
  delete global.experimentalYarnHooks;
});

test('install should call the linkStep hook', async () => {
  global.experimentalYarnHooks = {
    linkStep: jest.fn(cb => cb()),
  };
  await runInstall({}, 'install-production', config => {
    expect(global.experimentalYarnHooks.linkStep.mock.calls.length).toEqual(1);
  });
  delete global.experimentalYarnHooks;
});

test('install should call the buildStep hook', async () => {
  global.experimentalYarnHooks = {
    buildStep: jest.fn(cb => cb()),
  };
  await runInstall({}, 'install-production', config => {
    expect(global.experimentalYarnHooks.buildStep.mock.calls.length).toEqual(1);
  });
  delete global.experimentalYarnHooks;
});
