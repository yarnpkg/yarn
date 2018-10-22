/* @flow */
import * as fs from '../../src/util/fs.js';
import {run as pack} from '../../src/cli/commands/pack.js';
import {ConsoleReporter} from '../../src/reporters/index.js';
import {run as buildRun} from './_helpers.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;

const path = require('path');

const zlib = require('zlib');
const tarFs = require('tar-fs');
const fs2 = require('fs');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'pack');
const runPack = buildRun.bind(
  null,
  ConsoleReporter,
  fixturesLoc,
  async (args, flags, config, reporter, lockfile, getStdout): Promise<string> => {
    await pack(config, reporter, flags, args);
    return getStdout();
  },
);

export async function getFilesFromArchive(source, destination): Promise<Array<string>> {
  const unzip = new Promise((resolve, reject) => {
    fs2
      .createReadStream(source)
      .pipe(new zlib.Gunzip())
      .pipe(
        tarFs.extract(destination, {
          strip: 1,
          dmode: 0o555, // all dirs should be readable
          fmode: 0o444, // all files should be readable
          chown: false, // don't chown. just leave as it is
        }),
      )
      .on('finish', resolve)
      .on('error', reject);
  });
  await unzip;
  const files = (await fs.walk(destination)).map(({relative}) => relative);
  return files;
}

test.concurrent('pack should work with a minimal example', (): Promise<void> => {
  return runPack([], {}, 'minimal', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'pack-minimal-test-v1.0.0.tgz'),
      path.join(cwd, 'pack-minimal-test-v1.0.0'),
    );

    expect(files.length).toBeGreaterThanOrEqual(0);
  });
});

test.concurrent('pack should include all files listed in the files array', (): Promise<void> => {
  return runPack([], {}, 'files-include', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'files-include-v1.0.0.tgz'),
      path.join(cwd, 'files-include-v1.0.0'),
    );
    expect(files.sort()).toEqual(['a.js', 'b.js', 'dir', path.join('dir', 'nested.js'), 'index.js', 'package.json']);
  });
});

test.concurrent('pack should include files based from the package’s root', (): Promise<void> => {
  return runPack([], {}, 'files-include-from-root', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'files-include-from-root-v1.0.0.tgz'),
      path.join(cwd, 'files-include-from-root-v1.0.0'),
    );
    expect(files.indexOf('index.js')).toBeGreaterThanOrEqual(0);
    expect(files.indexOf('sub/index.js')).toEqual(-1);
  });
});

test.concurrent('pack should included globbed files', (): Promise<void> => {
  return runPack([], {}, 'files-glob', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'files-glob-v1.0.0.tgz'),
      path.join(cwd, 'files-glob-v1.0.0'),
    );
    expect(files.sort()).toEqual(
      ['lib', path.join('lib', 'a.js'), path.join('lib', 'b.js'), 'index.js', 'package.json'].sort(),
    );
  });
});

test.concurrent('pack should include mandatory files not listed in files array if files not empty', (): Promise<
  void,
> => {
  return runPack([], {}, 'files-include-mandatory', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'files-include-mandatory-v1.0.0.tgz'),
      path.join(cwd, 'files-include-mandatory-v1.0.0'),
    );
    const expected = ['package.json', 'index.js', 'readme.md', 'license', 'changelog'];
    expected.forEach(filename => {
      expect(files.indexOf(filename)).toBeGreaterThanOrEqual(0);
    });
  });
});

test.concurrent('pack should exclude mandatory files from ignored directories', (): Promise<void> => {
  return runPack([], {}, 'exclude-mandatory-files-from-ignored-directories', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'exclude-mandatory-files-from-ignored-directories-v1.0.0.tgz'),
      path.join(cwd, 'exclude-mandatory-files-from-ignored-directories-v1.0.0'),
    );
    expect(files.indexOf('index.js')).toBeGreaterThanOrEqual(0);
    expect(files.indexOf('package.json')).toBeGreaterThanOrEqual(0);
    expect(files.indexOf('node_modules')).toEqual(-1);
  });
});

test.concurrent('pack should include files only ignored in other directories', (): Promise<void> => {
  return runPack([], {}, 'include-files-ignored-in-other-directories', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'include-files-ignored-in-other-directories-v1.0.0.tgz'),
      path.join(cwd, 'include-files-ignored-in-other-directories-v1.0.0'),
    );
    expect(files.indexOf('a.js')).toBeGreaterThanOrEqual(0);
    expect(files.indexOf('index.js')).toBeGreaterThanOrEqual(0);
    expect(files.indexOf('ignoring/file.js')).toEqual(-1);
  });
});

test.concurrent('pack should exclude all other files if files array is not empty', (): Promise<void> => {
  return runPack([], {}, 'files-exclude', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'files-exclude-v1.0.0.tgz'),
      path.join(cwd, 'files-exclude-v1.0.0'),
    );
    const excluded = ['c.js'];
    excluded.forEach(filename => {
      expect(files.indexOf(filename)).toEqual(-1);
    });
  });
});

test.concurrent('pack should exclude all dotfiles if not in files and files not empty', (): Promise<void> => {
  return runPack([], {}, 'files-exclude-dotfile', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'files-exclude-dotfile-v1.0.0.tgz'),
      path.join(cwd, 'files-exclude-dotfile-v1.0.0'),
    );
    expect(files.indexOf('.dotfile')).toEqual(-1);
  });
});

test.concurrent('pack should exclude all files in dot-directories if not in files and files not empty', (): Promise<
  void,
> => {
  return runPack([], {}, 'files-exclude-dotdir', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'files-exclude-dotdir-v1.0.0.tgz'),
      path.join(cwd, 'files-exclude-dotdir-v1.0.0'),
    );
    expect(files.indexOf('a.js')).toEqual(-1);
  });
});

test.concurrent('pack should include bundled dependencies', (): Promise<void> => {
  return runPack([], {}, 'bundled-dependencies', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'bundled-dependencies-v1.0.0.tgz'),
      path.join(cwd, 'bundled-dependencies-v1.0.0'),
    );
    const expected = [
      'index.js',
      'package.json',
      'node_modules',
      path.join('node_modules', 'a'),
      path.join('node_modules', 'b'),
      path.join('node_modules', 'a', 'package.json'),
      path.join('node_modules', 'b', 'package.json'),
    ];
    expect(files.sort()).toEqual(expected.sort());
  });
});

test.concurrent('pack should match dotfiles with globs', (): Promise<void> => {
  return runPack([], {}, 'glob-dotfile', async (config): Promise<void> => {
    const {cwd} = config;
    const files = await getFilesFromArchive(
      path.join(cwd, 'glob-dotfile-v1.0.0.tgz'),
      path.join(cwd, 'glob-dotfile-v1.0.0'),
    );
    const expected = ['index.js', 'package.json', 'dir', path.join('dir', '.dotfile')];
    expect(files.sort()).toEqual(expected.sort());
  });
});
