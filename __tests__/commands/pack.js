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
  checkArchive?: ?(config: Config) => ?Promise<void>,
): Promise<void> {
  return run(() => {
    return pack;
  }, flags, path.join(fixturesLoc, name), checkArchive);
}

export async function run(
  factory: () => (config: Config, reporter: Reporter, flags: Object, args: Array<string>) => Promise<void>,
  flags: Object,
  dir: string,
  checkArchive: ?(config: Config) => ?Promise<void>,
): Promise<void> {
  let out = '';
  const stdout = new stream.Writable({
    decodeStrings: false,
    write(data, encoding, cb) {
      out += data;
      cb();
    },
  });

  const reporter = new reporters.ConsoleReporter({stdout, stderr: stdout});

  const tmpRoot = path.join(
    os.tmpdir(),
    `yarn-${path.basename(dir)}-${Math.random()}`,
  );

  await fs.unlink(tmpRoot);
  const cwd = path.join(tmpRoot, 'cwd');
  await fs.copy(dir, cwd, reporter);

  for (const {basename, absolute} of await fs.walk(cwd)) {
    if (basename.toLowerCase() === '.ds_store') {
      await fs.unlink(absolute);
    }
  }

  try {
    const config = await Config.create({
      cwd,
      globalFolder: path.join(tmpRoot, '.yarn/.global'),
      cacheFolder: path.join(tmpRoot, '.yarn'),
      linkFolder: path.join(tmpRoot, '.yarn/.link'),
    }, reporter);

    await pack(config, reporter, flags, []);

    if (checkArchive) {
      await checkArchive(config);
    }
  } catch (err) {
    throw new Error(`${err && err.stack} \nConsole output:\n ${out}`);
  }
}

export async function getFilesFromArchive(source, destination): Promise<Array<string>> {
  const unzip = new Promise((resolve, reject) => {
    fs2.createReadStream(source)
      .pipe(new zlib.Gunzip())
      .pipe(tar.Extract({path: destination, strip: 1}))
      .on('end', resolve)
      .on('error', reject);
  });
  await unzip;
  const files = await fs.readdir(destination);
  return files;
}

test.concurrent('pack should work with a minimal example', (): Promise<void> => {
  return runPack({}, 'minimal', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'pack-minimal-test-v1.0.0.tgz'),
      path.join(cwd, 'pack-minimal-test-v1.0.0'),
    );

    assert.ok(files);
  });
});

test.concurrent('pack should inlude all files listed in the files array', (): Promise<void> => {
  return runPack({}, 'files-include', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'files-include-v1.0.0.tgz'),
      path.join(cwd, 'files-include-v1.0.0'),
    );
    const expected = ['index.js', 'a.js', 'b.js'];
    expected.forEach((filename) => {
      assert(files.indexOf(filename) >= 0);
    });
  });
});

test.concurrent('pack should include mandatory files not listed in files array if files not empty',
(): Promise<void> => {
  return runPack({}, 'files-include-mandatory', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'files-include-mandatory-v1.0.0.tgz'),
      path.join(cwd, 'files-include-mandatory-v1.0.0'),
    );
    const expected = ['package.json', 'readme.md', 'license', 'changelog'];
    expected.forEach((filename) => {
      assert(files.indexOf(filename) >= 0);
    });
  });
});

test.concurrent('pack should exclude mandatory files from ignored directories', (): Promise<void> => {
  return runPack({}, 'exclude-mandatory-files-from-ignored-directories', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'exclude-mandatory-files-from-ignored-directories-v1.0.0.tgz'),
      path.join(cwd, 'exclude-mandatory-files-from-ignored-directories-v1.0.0'),
    );
    assert(files.indexOf('index.js') >= 0);
    assert(files.indexOf('package.json') >= 0);
    assert(files.indexOf('node_modules') === -1);
  });
});

test.concurrent('pack should exclude all other files if files array is not empty',
(): Promise<void> => {
  return runPack({}, 'files-exclude', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'files-exclude-v1.0.0.tgz'),
      path.join(cwd, 'files-exclude-v1.0.0'),
    );
    const excluded = ['c.js'];
    excluded.forEach((filename) => {
      assert(!(files.indexOf(filename) >= 0));
    });
  });
});

test.concurrent('pack should exclude all dotflies if not in files and files not empty',
(): Promise<void> => {
  return runPack({}, 'files-exclude-dotfile', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'files-exclude-dotfile-v1.0.0.tgz'),
      path.join(cwd, 'files-exclude-dotfile-v1.0.0'),
    );
    assert(!(files.indexOf('.dotfile') >= 0));
  });
});

test.concurrent('pack should exclude all files in dot-directories if not in files and files not empty ',
(): Promise<void> => {
  return runPack({}, 'files-exclude-dotdir', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'files-exclude-dotdir-v1.0.0.tgz'),
      path.join(cwd, 'files-exclude-dotdir-v1.0.0'),
    );
    assert(!(files.indexOf('a.js') >= 0));
  });
});
