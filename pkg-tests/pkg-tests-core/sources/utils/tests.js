const crypto = require(`crypto`);
const deepResolve = require(`super-resolve`);
const http = require(`http`);
const semver = require(`semver`);

const fsUtils = require(`./fs`);

exports.getPackageRegistry = function getPackageRegistry() {
  if (getPackageRegistry.promise) {
    return getPackageRegistry.promise;
  }

  return (getPackageRegistry.promise = (async () => {
    const packageVersions = new Map();
    for (const packageFile of await fsUtils.walk(`${require(`pkg-tests-fixtures`)}/packages`, {
      filter: [`package.json`],
    })) {
      const packageJson = await fsUtils.readJson(packageFile);
      const {name, version} = packageJson;

      if (name.startsWith(`git-`)) {
        continue;
      }

      if (!packageVersions.has(name)) {
        packageVersions.set(name, new Map());
      }

      packageVersions.get(name).set(version, {
        path: require(`path`).dirname(packageFile),
        packageJson,
      });
    }

    return packageVersions;
  })());
};

exports.getPackageEntry = async function getPackageEntry(name) {
  const packageRegistry = await exports.getPackageRegistry();

  return packageRegistry.get(name);
};

exports.getPackageArchiveStream = async function getPackageArchiveStream(name, version) {
  const packageEntry = await exports.getPackageEntry(name);

  if (!packageEntry) {
    throw new Error(`Unknown package "${name}"`);
  }

  if (!packageEntry.has(version)) {
    throw new Error(`Unknown version "${version}" for package "${name}"`);
  }

  return fsUtils.packToStream(packageEntry.get(version).path, {
    virtualPath: `/package`,
  });
};

exports.getPackageArchivePath = async function getPackageArchivePath(name, version) {
  const packageEntry = await exports.getPackageEntry(name);

  if (!packageEntry) {
    throw new Error(`Unknown package "${name}"`);
  }

  if (!packageEntry.has(version)) {
    throw new Error(`Unknown version "${version}" for package "${name}"`);
  }

  const archivePath = await fsUtils.createTemporaryFile(`${name}-${version}.tar.gz`);

  await fsUtils.packToFile(archivePath, packageEntry.get(version).path, {
    virtualPath: `/package`,
  });

  return archivePath;
};

exports.getPackageArchiveHash = async function getPackageArchiveHash(name, version) {
  const stream = await exports.getPackageArchiveStream(name, version);

  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    hash.setEncoding('hex');

    // Send the archive to the hash function
    stream.pipe(hash);

    stream.on(`end`, () => {
      resolve(hash.read());
    });
  });
};

exports.getPackageHttpArchivePath = async function getPackageHttpArchivePath(name, version) {
  const packageEntry = await exports.getPackageEntry(name);

  if (!packageEntry) {
    throw new Error(`Unknown package "${name}"`);
  }

  if (!packageEntry.has(version)) {
    throw new Error(`Unknown version "${version}" for package "${name}"`);
  }

  const serverUrl = await exports.startPackageServer();
  const archiveUrl = `${serverUrl}/${name}/-/${name}-${version}.tgz`;

  return archiveUrl;
};

exports.getPackageDirectoryPath = async function getPackageDirectoryPath(name, version) {
  const packageEntry = await exports.getPackageEntry(name);

  if (!packageEntry) {
    throw new Error(`Unknown package "${name}"`);
  }

  if (!packageEntry.has(version)) {
    throw new Error(`Unknown version "${version}" for package "${name}"`);
  }

  return packageEntry.get(version).path;
};

exports.startPackageServer = function startPackageServer() {
  if (startPackageServer.url) {
    return startPackageServer.url;
  }

  async function processPackageInfo(params, res) {
    if (!params) {
      return false;
    }

    const [, scope, localName] = params;
    const name = scope ? `${scope}/${localName}` : localName;

    const packageEntry = await exports.getPackageEntry(name);

    if (!packageEntry) {
      return processError(res, 404, `Package not found: ${name}`);
    }

    const versions = Array.from(packageEntry.keys());

    const data = JSON.stringify({
      name,
      versions: Object.assign(
        {},
        ...(await Promise.all(
          versions.map(async version => {
            return {
              [version]: Object.assign({}, packageEntry.get(version).packageJson, {
                dist: {
                  shasum: await exports.getPackageArchiveHash(name, version),
                  tarball: await exports.getPackageHttpArchivePath(name, version),
                },
              }),
            };
          }),
        )),
      ),
      [`dist-tags`]: {latest: semver.maxSatisfying(versions, '*')},
    });

    res.writeHead(200, {[`Content-Type`]: `application/json`});
    res.end(data);

    return true;
  }

  async function processPackageTarball(params, res) {
    if (!params) {
      return false;
    }

    const [, scope, localName, version] = params;
    const name = scope ? `${scope}/${localName}` : localName;

    const packageEntry = await exports.getPackageEntry(name);

    if (!packageEntry || !packageEntry.has(version)) {
      return processError(res, 404, `Package not found: ${name}`);
    }

    const path = packageEntry.get(version).path;

    res.writeHead(200, {
      [`Content-Type`]: `application/octet-stream`,
      [`Transfer-Encoding`]: `chunked`,
    });

    const packStream = fsUtils.packToStream(path, {virtualPath: `/package`});
    packStream.pipe(res);

    return true;
  }

  function processError(res, statusCode, errorMessage) {
    console.error(errorMessage);

    res.writeHead(statusCode);
    res.end(errorMessage);

    return true;
  }

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (await processPackageInfo(req.url.match(/^\/(?:(@[^\/]+)\/)?([^@\/][^\/]*)$/), res)) {
          return;
        }

        if (await processPackageTarball(req.url.match(/^\/(?:(@[^\/]+)\/)?([^@\/][^\/]*)\/-\/\2-(.*)\.tgz$/), res)) {
          return;
        }

        processError(res, 404, `Invalid route: ${req.url}`);
      } catch (error) {
        processError(res, 500, error.stack);
      }
    });

    // We don't want the server to prevent the process from exiting
    server.unref();

    server.listen(() => {
      const {port} = server.address();
      resolve((startPackageServer.url = `http://localhost:${port}`));
    });
  });
};

exports.generatePkgDriver = function generatePkgDriver({runDriver}) {
  function withConfig(definition) {
    const makeTemporaryEnv = (packageJson, subDefinition, fn) => {
      if (typeof subDefinition === `function`) {
        fn = subDefinition;
        subDefinition = {};
      }

      if (typeof fn !== `function`) {
        throw new Error(
          // eslint-disable-next-line
          `Invalid test function (got ${typeof fn}) - you probably put the closing parenthesis of the "makeTemporaryEnv" utility at the wrong place`,
        );
      }

      return async function() {
        const path = await fsUtils.createTemporaryFolder();

        const registryUrl = await exports.startPackageServer();

        // Writes a new package.json file into our temporary directory
        await fsUtils.writeJson(`${path}/package.json`, await deepResolve(packageJson));

        const run = (...args) => {
          return runDriver(path, args, {
            registryUrl,
            ...subDefinition,
          });
        };

        const source = async script => {
          return JSON.parse((await run(`node`, `-p`, `JSON.stringify(${script})`)).stdout);
        };

        await fn({
          path,
          run,
          source,
        });
      };
    };

    makeTemporaryEnv.withConfig = subDefinition => {
      return withConfig({...definition, ...subDefinition});
    };

    return makeTemporaryEnv;
  }

  return withConfig({});
};
