/* @flow */

import type {Gzip} from 'zlib';

const fs = require('fs-extra');
const klaw = require('klaw');
const path = require('path');
const tarFs = require('tar-fs');
const tmp = require('tmp');
const zlib = require('zlib');

const miscUtils = require('./misc');

const IS_WIN32 = process.platform === `win32`;

exports.walk = function walk(
  source: string,
  {filter, relative = false}: {|filter?: Array<string>, relative?: boolean|} = {},
): Promise<Array<string>> {
  return new Promise((resolve, reject) => {
    const paths = [];

    const walker = klaw(source, {
      filter: itemPath => {
        if (!filter) {
          return true;
        }

        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          return true;
        }

        const relativePath = path.relative(source, itemPath);

        if (miscUtils.filePatternMatch(relativePath, filter)) {
          return true;
        }

        return false;
      },
    });

    walker.on('data', ({path: itemPath}) => {
      const relativePath = path.relative(source, itemPath);

      if (!filter || miscUtils.filePatternMatch(relativePath, filter)) {
        paths.push(relative ? relativePath : itemPath);
      }

      // This item has been accepted only because it's a directory; it doesn't match the filter
      return;
    });

    walker.on('end', () => {
      resolve(paths);
    });
  });
};

exports.packToStream = function packToStream(
  source: string,
  // $FlowFixMe Flow doesn't support null default parameters in exact types
  {virtualPath = null}: {|virtualPath?: ?string|} = {},
): Gzip {
  if (virtualPath) {
    if (!path.isAbsolute(virtualPath)) {
      throw new Error('The virtual path has to be an absolute path');
    } else {
      virtualPath = path.resolve(virtualPath);
    }
  }

  const zipperStream = zlib.createGzip();

  const packStream = tarFs.pack(source, {
    map: header => {
      if (true) {
        header.name = path.posix.resolve('/', header.name);
        header.name = path.posix.relative('/', header.name);
      }

      if (virtualPath) {
        header.name = path.posix.resolve('/', virtualPath, header.name);
        header.name = path.posix.relative('/', header.name);
      }

      return header;
    },
  });

  packStream.pipe(zipperStream);

  packStream.on('error', error => {
    zipperStream.emit('error', error);
  });

  return zipperStream;
};

exports.packToFile = function packToFile(target: string, source: string, options: *): Promise<void> {
  const tarballStream = fs.createWriteStream(target);

  const packStream = exports.packToStream(source, options);
  packStream.pipe(tarballStream);

  return new Promise((resolve, reject) => {
    tarballStream.on('error', error => {
      reject(error);
    });

    packStream.on('error', error => {
      reject(error);
    });

    tarballStream.on('close', () => {
      resolve();
    });
  });
};

exports.createTemporaryFolder = function createTemporaryFolder(): Promise<string> {
  return new Promise((resolve, reject) => {
    tmp.dir({unsafeCleanup: true}, (error, dirPath) => {
      if (error) {
        reject(error);
      } else {
        resolve(dirPath);
      }
    });
  });
};

exports.createTemporaryFile = async function createTemporaryFile(filePath: string): Promise<string> {
  if (filePath) {
    if (path.normalize(filePath).match(/^(\.\.)?\//)) {
      throw new Error('A temporary file path must be a forward path');
    }

    const folderPath = await exports.createTemporaryFolder();
    return path.resolve(folderPath, filePath);
  } else {
    return new Promise((resolve, reject) => {
      tmp.file({discardDescriptor: true}, (error, filePath) => {
        if (error) {
          reject(error);
        } else {
          resolve(filePath);
        }
      });
    });
  }
};

exports.writeFile = async function writeFile(target: string, body: string | Buffer): Promise<void> {
  await fs.mkdirp(path.dirname(target));
  await fs.writeFile(target, body);
};

exports.readFile = function readFile(source: string, encoding: ?string = null): Promise<any> {
  return fs.readFile(source, encoding);
};

exports.writeJson = function writeJson(target: string, object: any): Promise<void> {
  return exports.writeFile(target, JSON.stringify(object));
};

exports.readJson = async function readJson(source: string): Promise<any> {
  const fileContent = await exports.readFile(source, 'utf8');

  try {
    return JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Invalid json file (${source})`);
  }
};

exports.chmod = async function chmod(target: string, mod: number): Promise<void> {
  await fs.chmod(target, mod);
};

exports.realpath = function realpath(source: string): Promise<string> {
  return fs.realpath(source);
};

exports.makeFakeBinary = async function(
  target: string,
  {output = `Fake binary`, exitCode = 1}: {|output: string, exitCode: number|} = {},
): Promise<void> {
  const realTarget = IS_WIN32 ? `${target}.cmd` : target;
  const header = IS_WIN32 ? `@echo off\n` : `#!/bin/sh\n`;

  await exports.writeFile(realTarget, `${header}echo ${output}\nexit ${exitCode}\n`);
  await exports.chmod(realTarget, 0o755);
};
