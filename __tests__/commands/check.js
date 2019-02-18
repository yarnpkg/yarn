/* @flow */

import {run as buildRun, runInstall} from './_helpers.js';
import * as checkCmd from '../../src/cli/commands/check.js';
import {Install} from '../../src/cli/commands/install.js';
import Lockfile from '../../src/lockfile';
import * as reporters from '../../src/reporters/index.js';
import type {CLIFunctionReturn} from '../../src/types.js';
import * as fs from '../../src/util/fs.js';

const path = require('path');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'check');

const runCheck = buildRun.bind(
  null,
  reporters.ConsoleReporter,
  fixturesLoc,
  (args, flags, config, reporter): CLIFunctionReturn => {
    return checkCmd.run(config, reporter, flags, args);
  },
);

test.concurrent('--verify-tree should report wrong version', async (): Promise<void> => {
  let thrown = false;
  try {
    await runCheck([], {verifyTree: true}, 'verify-tree-version-mismatch');
  } catch (e) {
    thrown = true;
  }
  expect(thrown).toEqual(true);
});

test.concurrent('--verify-tree should work from a workspace cwd', async (): Promise<void> => {
  let thrown = false;
  try {
    await runCheck([], {verifyTree: true}, {source: 'verify-tree-workspace-cwd', cwd: '/packages/workspace-1'});
  } catch (e) {
    thrown = true;
  }
  expect(thrown).toEqual(false);
});

test.concurrent('--verify-tree should report missing dependency', async (): Promise<void> => {
  let thrown = false;
  try {
    await runCheck([], {verifyTree: true}, 'verify-tree-not-found');
  } catch (e) {
    thrown = true;
  }
  expect(thrown).toEqual(true);
});

test.concurrent('--verify-tree should pass on hoisted dependency ', async (): Promise<void> => {
  await runCheck([], {verifyTree: true}, 'verify-tree-hoisted');
});

test.concurrent('--verify-tree should check dev dependencies ', async (): Promise<void> => {
  let thrown = false;
  try {
    await runCheck([], {verifyTree: true, production: false}, 'verify-tree-dev');
  } catch (e) {
    thrown = true;
  }
  expect(thrown).toEqual(true);
});

test.concurrent('--verify-tree should check skip dev dependencies if --production flag passed', async (): Promise<
  void,
> => {
  await runCheck([], {verifyTree: true, production: true}, 'verify-tree-dev-prod');
});

test.concurrent('--verify-tree should check skip deeper dev dependencies', async (): Promise<void> => {
  await runCheck([], {verifyTree: true, production: true}, 'verify-tree-dev-deep');
});

test.concurrent('--integrity should ignore comments and whitespaces in yarn.lock', async (): Promise<void> => {
  await runInstall({}, path.join('..', 'check', 'integrity-lock-check'), async (config, reporter): Promise<void> => {
    let lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    lockfile += "\n# ADDING THIS COMMENT WON'T AFFECT INTEGRITY CHECK \n";
    await fs.writeFile(path.join(config.cwd, 'yarn.lock'), lockfile);

    let thrown = false;
    try {
      await checkCmd.run(config, reporter, {integrity: true}, []);
    } catch (e) {
      thrown = true;
    }
    expect(thrown).toEqual(false);
  });
});

test.concurrent('--integrity should fail if integrity file is missing', async (): Promise<void> => {
  await runInstall({}, path.join('..', 'check', 'integrity-lock-check'), async (config, reporter): Promise<void> => {
    await fs.unlink(path.join(config.cwd, 'node_modules', '.yarn-integrity'));

    let thrown = false;
    try {
      await checkCmd.run(config, reporter, {integrity: true}, []);
    } catch (e) {
      thrown = true;
    }
    expect(thrown).toEqual(true);
  });
});

test.concurrent('--integrity should fail if integrity file is not a json', async (): Promise<void> => {
  await runInstall(
    {},
    path.join('..', 'check', 'integrity-lock-check'),
    async (config, reporter, install, getStdout): Promise<void> => {
      await fs.writeFile(path.join(config.cwd, 'node_modules', '.yarn-integrity'), 'not a json');

      let thrown = false;
      try {
        await checkCmd.run(config, reporter, {integrity: true}, []);
      } catch (e) {
        thrown = true;
      }
      expect(thrown).toEqual(true);
      expect(getStdout()).toContain('Integrity check: integrity file is not a json');
    },
  );
});

test.concurrent('--integrity should fail if yarn.lock has patterns changed', async (): Promise<void> => {
  await runInstall({}, path.join('..', 'check', 'integrity-lock-check'), async (config, reporter): Promise<void> => {
    let lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
    lockfile = lockfile.replace('left-pad@1.1.1', 'left-pad@1.1.0');
    await fs.writeFile(path.join(config.cwd, 'yarn.lock'), lockfile);

    let thrown = false;
    try {
      await checkCmd.run(config, reporter, {integrity: true}, []);
    } catch (e) {
      thrown = true;
    }
    expect(thrown).toEqual(true);
  });
});

test.concurrent('--integrity should fail if yarn.lock has new pattern', async (): Promise<void> => {
  await runInstall(
    {},
    path.join('..', 'check', 'integrity-lock-check'),
    async (config, reporter, install, getStdout): Promise<void> => {
      let lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      lockfile += `\nxtend@^4.0.0:
  version "4.0.1"
  resolved "https://registry.yarnpkg.com/xtend/-/xtend-4.0.1.tgz#a5c6d532be656e23db820efb943a1f04998d63af"`;
      await fs.writeFile(path.join(config.cwd, 'yarn.lock'), lockfile);

      let thrown = false;
      try {
        await checkCmd.run(config, reporter, {integrity: true}, []);
      } catch (e) {
        thrown = true;
      }
      expect(thrown).toEqual(true);
      expect(getStdout()).toContain("Integrity check: Lock files don't match");
    },
  );
});

test.concurrent('--integrity should fail if yarn.lock has resolved changed', async (): Promise<void> => {
  await runInstall(
    {},
    path.join('..', 'check', 'integrity-lock-check'),
    async (config, reporter, install, getStdout): Promise<void> => {
      let lockfile = await fs.readFile(path.join(config.cwd, 'yarn.lock'));
      lockfile = lockfile.replace(
        'https://registry.npmjs.org/left-pad/-/left-pad-1.1.1.tgz',
        'https://registry.yarnpkg.com/left-pad/-/left-pad-1.1.1.tgz',
      );
      await fs.writeFile(path.join(config.cwd, 'yarn.lock'), lockfile);

      let thrown = false;
      try {
        await checkCmd.run(config, reporter, {integrity: true}, []);
      } catch (e) {
        thrown = true;
      }
      expect(thrown).toEqual(true);
      expect(getStdout()).toContain("Integrity check: Lock files don't match");
    },
  );
});

test.concurrent('--integrity should fail if files are missing and --check-files is passed', async (): Promise<void> => {
  await runInstall(
    {checkFiles: true},
    path.join('..', 'check', 'integrity-lock-check'),
    async (config, reporter, install, getStdout): Promise<void> => {
      await fs.unlink(path.join(config.cwd, 'node_modules', 'left-pad', 'index.js'));

      let thrown = false;
      try {
        await checkCmd.run(config, reporter, {integrity: true, checkFiles: true}, []);
      } catch (e) {
        thrown = true;
      }
      expect(thrown).toEqual(true);
      expect(getStdout()).toContain('Integrity check: Files are missing');
    },
  );
});

test.concurrent('--integrity should fail if --ignore-scripts is changed', async (): Promise<void> => {
  await runInstall(
    {ignoreScripts: true},
    path.join('..', 'check', 'integrity-lock-check'),
    async (config, reporter, install, getStdout): Promise<void> => {
      let thrown = false;
      try {
        config.ignoreScripts = false;
        await checkCmd.run(config, reporter, {integrity: true, ignoreScripts: false}, []);
      } catch (e) {
        thrown = true;
      }
      expect(thrown).toEqual(true);
      expect(getStdout()).toContain("Integrity check: Flags don't match");
    },
  );
});

test.concurrent('when switching to --check-files install should rebuild integrity file', async (): Promise<void> => {
  await runInstall({}, path.join('..', 'check', 'integrity-lock-check'), async (config, reporter): Promise<void> => {
    await fs.unlink(path.join(config.cwd, 'node_modules', 'left-pad', 'index.js'));

    // reinstall should skip because current installation does not track files
    let reinstall = new Install({}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'left-pad', 'index.js'))).toEqual(false);
    // integrity check won't notice missing file
    let thrown = false;
    try {
      await checkCmd.run(config, reporter, {integrity: true}, []);
    } catch (e) {
      thrown = true;
    }
    expect(thrown).toEqual(false);

    // reinstall with --check-files tag should reinstall missing files and generate proper integrity
    reinstall = new Install({checkFiles: true}, config, reporter, await Lockfile.fromDirectory(config.cwd));
    await reinstall.init();
    // all correct
    thrown = false;
    try {
      await checkCmd.run(config, reporter, {integrity: true, checkFiles: true}, []);
    } catch (e) {
      thrown = true;
    }
    expect(thrown).toEqual(false);
    expect(await fs.exists(path.join(config.cwd, 'node_modules', 'left-pad', 'index.js'))).toEqual(true);

    // removed file will be noticed
    thrown = false;
    await fs.unlink(path.join(config.cwd, 'node_modules', 'left-pad', 'index.js'));
    try {
      await checkCmd.run(config, reporter, {integrity: true, checkFiles: true}, []);
    } catch (e) {
      thrown = true;
    }
    expect(thrown).toEqual(true);
  });
});

test.concurrent('--integrity should fail if integrity file have different linkedModules', async (): Promise<void> => {
  await runInstall(
    {},
    path.join('..', 'check', 'integrity-lock-check'),
    async (config, reporter, install, getStdout): Promise<void> => {
      const integrityFilePath = path.join(config.cwd, 'node_modules', '.yarn-integrity');
      const integrityFile = JSON.parse(await fs.readFile(integrityFilePath));
      integrityFile.linkedModules.push('aLinkedModule');
      await fs.writeFile(integrityFilePath, JSON.stringify(integrityFile, null, 2));

      let thrown = false;
      try {
        await checkCmd.run(config, reporter, {integrity: true}, []);
      } catch (e) {
        thrown = true;
      }
      expect(thrown).toEqual(true);
      expect(getStdout()).toContain("Integrity check: Linked modules don't match");
    },
  );
});

test.concurrent('--integrity should fail if integrity file has different systemParams', async (): Promise<void> => {
  await runInstall(
    {},
    path.join('..', 'check', 'integrity-lock-check'),
    async (config, reporter, install, getStdout): Promise<void> => {
      const integrityFilePath = path.join(config.cwd, 'node_modules', '.yarn-integrity');
      const integrityFile = JSON.parse(await fs.readFile(integrityFilePath));
      integrityFile.systemParams = '[unexpected systemParams value]';
      await fs.writeFile(integrityFilePath, JSON.stringify(integrityFile, null, 2));

      let thrown = false;
      try {
        await checkCmd.run(config, reporter, {integrity: true}, []);
      } catch (e) {
        thrown = true;
      }
      expect(thrown).toEqual(true);
      expect(getStdout()).toContain(reporter.lang('integritySystemParamsDontMatch'));
    },
  );
});

test.concurrent('--integrity should create the integrity file under the meta folder if enabled', async (): Promise<
  void,
> => {
  await runInstall(
    {},
    path.join('..', 'check', 'integrity-meta-folder'),
    async (config, reporter, install, getStdout): Promise<void> => {
      await checkCmd.run(config, reporter, {integrity: true}, []);
      expect(await fs.exists(path.join(config.cwd, '.yarn-meta', '.yarn-integrity'))).toEqual(true);
    },
  );
});

test.concurrent('--check-files should register the right entries even when using the meta folder', async (): Promise<
  void,
> => {
  await runInstall(
    {checkFiles: true},
    path.join('..', 'check', 'integrity-meta-folder'),
    async (config, reporter, install, getStdout): Promise<void> => {
      const integrityFilePath = path.join(config.cwd, '.yarn-meta', '.yarn-integrity');
      const integrityFile = JSON.parse(await fs.readFile(integrityFilePath));
      expect(integrityFile.files.length).toBeGreaterThan(0);
    },
  );
});

// https://github.com/yarnpkg/yarn/issues/3276
test.concurrent('--integrity --check-files should not die on broken symlinks', async (): Promise<void> => {
  await runInstall(
    {checkFiles: true, binLinks: true},
    path.join('..', 'check', 'integrity-symlinks'),
    async (config, reporter, install): Promise<void> => {
      await fs.unlink(path.join(config.cwd, 'node_modules', 'acorn'));
      let thrown = false;
      try {
        const reinstall = new Install(
          {checkFiles: true, binLinks: true},
          config,
          reporter,
          await Lockfile.fromDirectory(config.cwd),
        );
        await reinstall.init();
      } catch (e) {
        thrown = true;
      }
      expect(thrown).toEqual(false);
    },
  );
});

test.concurrent('--integrity should not die on missing fields in integrity file', async (): Promise<void> => {
  let integrityError = false;
  try {
    await runCheck([], {integrity: true}, 'missing-fields');
  } catch (err) {
    integrityError = true;
  }
  expect(integrityError).toEqual(false);
});

test.concurrent('should ignore bundled dependencies', async (): Promise<void> => {
  await runInstall(
    {},
    path.join('..', 'check', 'bundled-dep-check'),
    async (config, reporter, install, getStdout): Promise<void> => {
      await checkCmd.run(config, reporter, {}, []);
      expect(getStdout().indexOf('warning')).toEqual(-1);
    },
  );
});

test.concurrent('should warn about mismatched dependencies if they match resolutions (simple)', async (): Promise<
  void,
> => {
  let mismatchError = false;
  let stdout = '';
  try {
    await runCheck([], {}, 'resolutions', (config, reporter, check, getStdout) => {
      stdout = getStdout();
    });
  } catch (err) {
    mismatchError = true;
  }
  expect(mismatchError).toEqual(false);
  expect(
    stdout.search(
      `warning.*"repeat-string@1.4.0" is incompatible with requested version "pad-left#repeat-string@\\^1.5.4"`,
    ),
  ).toBeGreaterThan(-1);
});

test.concurrent('should warn about mismatched dependencies if they match resolutions (tree)', async (): Promise<
  void,
> => {
  let mismatchError = false;
  let stdout = '';
  try {
    await runCheck([], {}, 'resolutions-tree', (config, reporter, check, getStdout) => {
      stdout = getStdout();
    });
  } catch (err) {
    mismatchError = true;
  }
  expect(mismatchError).toEqual(false);
  expect(
    stdout.search(
      `warning.*"repeat-string@1.4.0" is incompatible with requested version "pad-left#repeat-string@\\^1.5.4"`,
    ),
  ).toBeGreaterThan(-1);
});

test.concurrent('should warn about mismatched dependencies if they match resolutions (glob)', async (): Promise<
  void,
> => {
  let mismatchError = false;
  let stdout = '';
  try {
    await runCheck([], {}, 'resolutions-glob', (config, reporter, check, getStdout) => {
      stdout = getStdout();
    });
  } catch (err) {
    mismatchError = true;
  }
  expect(mismatchError).toEqual(false);
  expect(
    stdout.search(
      `warning.*"repeat-string@1.4.0" is incompatible with requested version "pad-left#repeat-string@\\^1.5.4"`,
    ),
  ).toBeGreaterThan(-1);
});

test.concurrent('--integrity should throw an error if top level patterns do not match', async (): Promise<void> => {
  let integrityError = false;
  try {
    await runCheck([], {integrity: true}, 'integrity-top-level-patters');
  } catch (err) {
    integrityError = true;
  }
  expect(integrityError).toEqual(true);
});
