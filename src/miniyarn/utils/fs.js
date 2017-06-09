import * as Fse from 'fs-extra';
import * as Fs from 'fs';
import gunzipMaybe from 'gunzip-maybe';
import klaw from 'klaw';
import Path from 'path';
import rcopy from 'recursive-copy';
import tarFs from 'tar-fs';
import tar from 'tar-stream';
import tmp from 'tmp';
import {createGzip} from 'zlib';

import * as archiveUtils from 'miniyarn/utils/archive';
import * as miscUtils from 'miniyarn/utils/misc';
import * as pathUtils from 'miniyarn/utils/path';
import * as parseUtils from 'miniyarn/utils/parse';

let isWindows = null;

export async function detectWindows() {
  if (isWindows !== null) return isWindows;

  if (await exists(`c:/`)) return (isWindows = true);

  if ((await exists(`/proc/version`)) && (await readFile(`/proc/version`, `utf8`)).match(/Microsoft|WSL/))
    return (isWindows = true);

  return (isWindows = false);
}

export async function cwd(path, callback) {
  let cwd = process.cwd();
  process.chdir(path);

  try {
    return await callback();
  } finally {
    process.chdir(cwd);
  }
}

export async function symlink(source, destination) {
  return await new Promise((resolve, reject) => {
    Fs.symlink(source, destination, error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export async function ensureSymlink(source, destination) {
  return await new Promise((resolve, reject) => {
    Fse.ensureSymlink(source, destination, error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export async function isDirectory(path) {
  return await new Promise((resolve, reject) => {
    Fs.lstat(path, (error, stat) => {
      if (error) {
        reject(error);
      } else {
        resolve(stat.isDirectory());
      }
    });
  });
}

export async function createTemporaryFolder() {
  return new Promise((resolve, reject) => {
    tmp.dir({unsafeCleanup: true}, (error, path) => {
      if (error) {
        reject(error);
      } else {
        resolve(path);
      }
    });
  });
}

export async function createTemporaryPath(subPath = `temp`) {
  if (!pathUtils.isForward(subPath)) throw new Error(`A temporary subpath must be a forward path`);

  let folderPath = await createTemporaryFolder();
  let temporaryPath = pathUtils.resolve(folderPath, subPath);

  return temporaryPath;
}

export async function createTemporaryFile(filePath) {
  if (filePath) {
    let filePath = await createTemporaryPath(filePath);
    await writeFile(filePath, ``);

    return filePath;
  } else {
    return await new Promise((resolve, reject) => {
      tmp.file((error, path) => {
        if (error) {
          reject(error);
        } else {
          resolve(path);
        }
      });
    });
  }
}

export async function walk(path, {filter} = {}) {
  return await new Promise((resolve, reject) => {
    let paths = [];

    let walker = klaw(path, {
      filter: itemPath => {
        if (!filter) return true;

        if (Fse.statSync(path).isDirectory()) return true;
        s;
        let relativePath = pathUtils.relative(path, itemPath);

        if (miscUtils.filePatternMatch(relativePath, filter)) return true;

        return false;
      },
    });

    walker.on(`data`, ({path: itemPath}) => {
      if (!filter) return void paths.push(itemPath);

      let relativePath = pathUtils.relative(path, itemPath);

      if (miscUtils.filePatternMatch(relativePath, filter)) return void paths.push(itemPath);

      return; // This item has been accepted only because it's a directory; it doesn't match the filter
    });

    walker.on(`end`, () => {
      resolve(paths);
    });
  });
}

export async function mkdirp(path) {
  return await new Promise((resolve, reject) => {
    Fse.ensureDir(path, error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

export async function rm(path) {
  if (path === ``) throw new Error(`Cannot rm an empty path`);

  if (path === `/`) throw new Error(`Cannot rm your whole / directory - something's very wrong`);

  if (!await exists(path)) return;

  return await new Promise((resolve, reject) => {
    Fse.remove(path, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export async function lstat(path) {
  return await new Promise((resolve, reject) => {
    Fs.lstat(path, (error, stat) => {
      if (error) {
        reject(error);
      } else {
        resolve(stat);
      }
    });
  });
}

export async function getMTime(path) {
  return await new Promise((resolve, reject) => {
    Fs.lstat(path, (error, stat) => {
      if (error) {
        reject(error);
      } else {
        resolve(stat.mtime);
      }
    });
  });
}

export async function createFileWriter(path) {
  await mkdirp(pathUtils.dirname(path));

  let stream = Fs.createWriteStream(path);

  stream.promise = new Promise((resolve, reject) => {
    stream.on(`finish`, () => {
      resolve();
    });

    stream.on(`error`, error => {
      reject(error);
    });
  });

  return stream;
}

export function createFileReader(path) {
  let stream = Fs.createReadStream(path);

  stream.promise = new Promise((resolve, reject) => {
    stream.on(`error`, error => {
      reject(error);
    });

    stream.on(`end`, () => {
      resolve();
    });
  });

  return stream;
}

export async function exists(path) {
  return await new Promise((resolve, reject) => {
    Fs.exists(path, status => {
      resolve(status);
    });
  });
}

export async function cp(source, destination, {filter = []} = {}) {
  await mkdirp(pathUtils.dirname(destination));
  await rcopy(source, destination, {dot: true, filter: path => miscUtils.filePatternMatch(path, filter)});
}

export async function mv(source, target) {
  // Windows defender often lock files after they are created, which makes it impossible to move them.
  // We could have a mechanism of "try again", but it seems simpler to just use a copy operation instead.
  // Note that using cp instead of mv is not strictly comparable since, unfortunately, it's not atomic. Nothing we can do, tho :(

  if (await detectWindows()) {
    await cp(source, target);
    await rm(source);
  } else {
    await mkdirp(pathUtils.dirname(target));

    return await new Promise((resolve, reject) => {
      Fs.rename(source, target, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

export async function extract(target, tarballPath, {stripLeadingFolder = false} = {}) {
  return await new Promise((resolve, reject) => {
    function map(header) {
      if (header.name[0] === `/`) header.name = header.name.replace(/^\/+/, ``);

      if (stripLeadingFolder) header.name = header.name.replace(/^[^\/]+\//, ``);

      return header;
    }

    let unzipper = gunzipMaybe();
    Fs.createReadStream(tarballPath).pipe(unzipper);

    let extractor = tarFs.extract(target, {map});
    unzipper.pipe(extractor);

    extractor.on(`error`, error => {
      reject(error);
    });

    extractor.on(`finish`, () => {
      resolve();
    });
  });
}

export function packToStream(path, {virtualPath = null} = {}) {
  if (virtualPath) {
    if (!pathUtils.isAbsolute(virtualPath)) {
      throw new Error(`The virtual path has to be an absolute path`);
    } else {
      virtualPath = pathUtils.resolve(virtualPath);
    }
  }

  let zipperStream = createGzip();

  let packStream = tarFs.pack(path, {
    map: header => {
      if (true) {
        header.name = pathUtils.resolve(`/`, header.name);
        header.name = pathUtils.relative(`/`, header.name);
      }

      if (virtualPath) {
        header.name = pathUtils.resolve(`/`, virtualPath, header.name);
        header.name = pathUtils.relative(`/`, header.name);
      }

      return header;
    },
  });

  packStream.pipe(zipperStream);

  packStream.on(`error`, error => {
    zipperStream.emit(`error`, error);
  });

  return zipperStream;
}

export async function packToFile(target, directoryPath, {...options} = {}) {
  let tarballStream = Fs.createWriteStream(target);

  let packStream = packToStream(directoryPath, options);
  packStream.pipe(tarballStream);

  return await new Promise((resolve, reject) => {
    tarballStream.on(`error`, error => {
      reject(error);
    });

    packStream.on(`error`, error => {
      reject(error);
    });

    tarballStream.on(`close`, () => {
      resolve();
    });
  });
}

export async function readArchiveListing(archivePath, {virtualPath = null} = {}) {
  let listing = [];

  let unpackStream = archiveUtils.createArchiveUnpacker(archivePath);
  unpackStream.pipe({ entry(header) { listing.push(pathUtils.resolve(`/`, header.name)); }, finalize() {} });

  let archiveStream = Fs.createReadStream(archivePath);
  archiveStream.pipe(unpackStream);

  await unpackStream.promise;

  return listing;
}

export async function writeFile(path, body) {
  await mkdirp(pathUtils.dirname(path));

  return await new Promise((resolve, reject) => {
    Fs.writeFile(path, body, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export async function writeJson(path, body) {
  await writeFile(path, parseUtils.stringifyJson(body));
}

export async function readFile(path, encoding = null) {
  return await new Promise((resolve, reject) => {
    Fs.readFile(path, encoding, (err, body) => {
      if (err) {
        reject(err);
      } else {
        resolve(body);
      }
    });
  });
}

export async function readJson(path) {
  let fileContent = await readFile(path, `utf8`);

  return parseUtils.parseJson(fileContent);
}

export async function readDirectory(path) {
  return await new Promise((resolve, reject) => {
    Fs.readdir(path, (err, entries) => {
      if (err) {
        reject(err);
      } else {
        resolve(entries);
      }
    });
  });
}

export class Handler {
  constructor(path, {temporary = false} = {}) {
    this.path = path;

    this.temporary = temporary;
  }

  get() {
    return this.path;
  }

  async steal(target = null, { temporary = null } = {}) {
    if (this.temporary) {
      if (!target) return this.path;
      await mv(this.path, target);
    } else {
      if (!target) target = await createTemporaryPath(pathUtils.basename(this.path));
      await cp(this.path, target);
    }
    return target;
  }
}
