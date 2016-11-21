/* @flow */

import {createReporter, getNoProgress} from '../../src/cli/index.js';

test('Setting showEmoji, noProgress parameter should bind booleans to base-reporter', () => {
  const showEmoji = false;
  const noProgress = true;
  const reporter = createReporter(showEmoji, noProgress);
  expect(reporter.emoji).toBe(false);
  expect(reporter.noProgress).toBe(true);
});

test('Setting noProgress via commander or in package.json to true should cause getNoProgress to return true', () => {
  let cmdrNoProgress = false;   
  let pkgNoProgress = true;
  let result = getNoProgress(cmdrNoProgress, pkgNoProgress);
  expect(result).toBe(true);
  
  cmdrNoProgress = false;
  pkgNoProgress = false;
  result = getNoProgress(cmdrNoProgress, pkgNoProgress);
  expect(result).toBe(false);

  cmdrNoProgress = true;
  pkgNoProgress = false;
  result = getNoProgress(cmdrNoProgress, pkgNoProgress);
  expect(result).toBe(true);

  cmdrNoProgress = undefined;
  pkgNoProgress = true;
  result = getNoProgress(cmdrNoProgress, pkgNoProgress);
  expect(result).toBe(true);

  cmdrNoProgress = undefined;
  pkgNoProgress = undefined;
  result = getNoProgress(cmdrNoProgress, pkgNoProgress);
  expect(result).toBe(false);
});
