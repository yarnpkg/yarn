const fs = require(`fs-extra`);
const klaw = require(`klaw`);
const path = require(`path`);
const tarFs = require(`tar-fs`);
const tmp = require(`tmp`);
const zlib = require(`zlib`);

const miscUtils = require(`./misc`);

exports.walk = function walk(source, {filter, relative = false} = {}) {
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

    walker.on(`data`, ({path: itemPath}) => {
      const relativePath = path.relative(source, itemPath);

      if (!filter || miscUtils.filePatternMatch(relativePath, filter)) {
        paths.push(relative ? relativePath : itemPath);
      }

      // This item has been accepted only because it's a directory; it doesn't match the filter
      return;
    });

    walker.on(`end`, () => {
      resolve(paths);
    });
  });
};

exports.packToStream = function packToStream(source, {virtualPath = null} = {}) {
  if (virtualPath) {
    if (!path.isAbsolute(virtualPath)) {
      throw new Error(`The virtual path has to be an absolute path`);
    } else {
      virtualPath = path.resolve(virtualPath);
    }
  }

  const zipperStream = zlib.createGzip();

  const packStream = tarFs.pack(source, {
    map: header => {
      if (true) {
        header.name = path.resolve(`/`, header.name);
        header.name = path.relative(`/`, header.name);
      }

      if (virtualPath) {
        header.name = path.resolve(`/`, virtualPath, header.name);
        header.name = path.relative(`/`, header.name);
      }

      return header;
    },
  });

  packStream.pipe(zipperStream);

  packStream.on(`error`, error => {
    zipperStream.emit(`error`, error);
  });

  return zipperStream;
};

exports.packToFile = function packToFile(target, source, {...options} = {}) {
  const tarballStream = fs.createWriteStream(target);

  const packStream = exports.packToStream(source, options);
  packStream.pipe(tarballStream);

  return new Promise((resolve, reject) => {
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
};

exports.createTemporaryFolder = function createTemporaryFolder() {
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

exports.createTemporaryFile = async function createTemporaryFile(filePath) {
  if (filePath) {
    if (path.normalize(filePath).match(/^(\.\.)?\//)) {
      throw new Error(`A temporary file path must be a forward path`);
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

exports.writeFile = async function writeFile(target, body) {
  await fs.mkdirp(path.dirname(target));
  await fs.writeFile(target, body);
};

exports.readFile = function readFile(source, encoding = null) {
  return fs.readFile(source, encoding);
};

exports.writeJson = function writeJson(target, object) {
  return exports.writeFile(target, JSON.stringify(object));
};

exports.readJson = async function readJson(source) {
  const fileContent = await exports.readFile(source, `utf8`);

  try {
    return JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Invalid json file (${source})`);
  }
};
