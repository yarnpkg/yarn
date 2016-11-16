/* @flow */
import type {Reporter} from '../../src/reporters/index.js';

import * as fs from '../../src/util/fs.js';
import assert from 'assert';
import {run as pack} from '../../src/cli/commands/pack.js';
import * as reporters from '../../src/reporters/index.js';
import Config from '../../src/config.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

const path = require('path');
const os = require('os');
const stream = require('stream');

const zlib = require('zlib');
const tar = require('tar');
const fs2 = require('fs');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'pack');

export function runPack(
  flags: Object,
  name: string,
  checkInitialized?: ?(config: Config) => ?Promise<void>,
): Promise<void> {
  return run(() => {
    return pack;
  }, flags, path.join(fixturesLoc, name), checkInitialized);
}

export async function run(
  factory: () => (config: Config, reporter: Reporter, flags: Object, args: Array<string>) => Promise<void>,
  flags: Object,
  dir: string,
  checkInitialized: ?(config: Config) => ?Promise<void>,
): Promise<void> {
  const cwd = path.join(
    os.tmpdir(),
    `yarn-${path.basename(dir)}-${Math.random()}`,
  );
  await fs.unlink(cwd);
  await fs.copy(dir, cwd);

  for (const {basename, absolute} of await fs.walk(cwd)) {
    if (basename.toLowerCase() === '.ds_store') {
      await fs.unlink(absolute);
    }
  }

  let out = '';
  const stdout = new stream.Writable({
    decodeStrings: false,
    write(data, encoding, cb) {
      out += data;
      cb();
    },
  });

  const reporter = new reporters.ConsoleReporter({stdout, stderr: stdout});

  try {
    const config = new Config(reporter);
    await config.init({
      cwd,
      globalFolder: path.join(cwd, '.yarn/.global'),
      cacheFolder: path.join(cwd, '.yarn'),
      linkFolder: path.join(cwd, '.yarn/.link'),
    });

    await pack(config, reporter, flags, []);

    try {
      if (checkInitialized) {
        await checkInitialized(config);
      }
    } finally {
      // clean up
      // todo: uncomment await fs.unlink(cwd);
    }
  } catch (err) {
    throw new Error(`${err && err.stack} \nConsole output:\n ${out}`);
  }
}

export async function getFilesFromArchive(source, destination): Promise<Array<string>> {
  const unzip = new Promise((resolve, reject) => {
    fs2.createReadStream(source)
      .pipe(zlib.createUnzip())
      .pipe(tar.Extract({path: destination, strip: 1}))
      .on('end', () => {
        resolve();
      })
      .on('error', (error) => {
        reject(error);
      });
  });
  await unzip;
  const files = await fs.readdir(destination);
  return files;
}

function compareFiles(actual, expected): Array<string> {
  const missing = [];
  expected.forEach((filename) => {
    if (actual.indexOf(filename) < 0) {
      missing.push(filename);
    }
  });
  return missing;
}


test.concurrent('pack should work with a minimal example',  (): Promise<void> => {
  return runPack({}, 'minimal', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'pack-minimal-test-v1.0.0.tgz'),
      path.join(cwd, 'pack-minimal-test-v1.0.0'),
    );

    assert.ok(files);
  });
});

test.concurrent('pack should work with a minimal example if the file is in a directory',  (): Promise<void> => {
  return runPack({}, 'minimal-directory', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'pack-minimal-directory-test-v1.0.0.tgz'),
      path.join(cwd, 'pack-minimal-directory-test-v1.0.0'),
    );

    assert.ok(files);
  });
});


test.concurrent('pack should work with a an empty file in a directory',  (): Promise<void> => {
  return runPack({}, 'directory-empty', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'pack-directory-empty-test-v1.0.0.tgz'),
      path.join(cwd, 'pack-directory-empty-test-v1.0.0'),
    );

    assert.ok(files);
  });
});

test.concurrent('pack should work with a nonempty file in a directory',  (): Promise<void> => {
  return runPack({}, 'directory-nonempty', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'pack-directory-nonempty-test-v1.0.0.tgz'),
      path.join(cwd, 'pack-directory-nonempty-test-v1.0.0'),
    );

    assert.ok(files);
  });
});

test.concurrent('pack should work with an empty file',  (): Promise<void> => {
  return runPack({}, 'emptyfile', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'pack-emptyfile-test-v1.0.0.tgz'),
      path.join(cwd, 'pack-emptyfile-test-v1.0.0'),
    );

    assert.ok(files);
  });
});

test.concurrent('pack should work with a dotfile',  (): Promise<void> => {
  return runPack({}, 'dotfile', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'pack-dotfile-test-v1.0.0.tgz'),
      path.join(cwd, 'pack-dotfile-test-v1.0.0'),
    );

    assert.ok(files);
  });
});

test.concurrent('pack should work with a dot-directory',  (): Promise<void> => {
  return runPack({}, 'dotdir', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'pack-dotdir-test-v1.0.0.tgz'),
      path.join(cwd, 'pack-dotdir-test-v1.0.0'),
    );

    assert.ok(files);
  });
});

test.concurrent('pack should work with a non-empty file in a dot-directory',  (): Promise<void> => {
  return runPack({}, 'dotdir_with_nonempty_file', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'pack-dotdir_with_nonempty_file-test-v1.0.0.tgz'),
      path.join(cwd, 'pack-dotdir_with_nonempty_file-test-v1.0.0'),
    );

    assert.ok(files);
  });
});

test.concurrent('pack should add all files if no other rules are defined',  (): Promise<void> => {
  return runPack({}, 'combined', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'pack-combined-test-v1.0.0.tgz'),
      path.join(cwd, 'pack-combined-test-v1.0.0'),
    );
    const expected = [
      '.yarn',
      'index.js',
      'package.json',
    ];
    const missing = compareFiles(files, expected);
    assert.deepEqual([], missing);
  });
});
