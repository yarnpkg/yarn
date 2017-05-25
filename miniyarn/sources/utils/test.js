import Http         from 'http';
import Path         from 'path';
import superResolve from 'super-resolve';

import { cli }      from 'miniyarn/cli';
import * as fsUtils from 'miniyarn/utils/fs';

export function getPackageRegistry() {

    if (getPackageRegistry.promise)
        return getPackageRegistry.promise;

    return getPackageRegistry.promise = (async () => {

        let packageVersions = new Map();

        for (let packageFile of await fsUtils.walk(`${__dirname}/../../tests/packages`, { filter: [ `package.json` ] })) {

            let packageJson = await fsUtils.readJson(packageFile);
            let { name, version } = packageJson;

            if (!packageVersions.has(name))
                packageVersions.set(name, new Map());

            packageVersions.get(name).set(version, {
                path: Path.dirname(packageFile),
                packageJson: packageJson,
            });

        }

        return packageVersions;

    })();

}

export async function getPackageEntry(name) {

    let packageRegistry = await getPackageRegistry();

    return packageRegistry.get(name);

}

export async function getPackageArchivePath(name, version) {

    let packageEntry = await getPackageEntry(name);

    if (!packageEntry)
        throw new Error(`Unknown package "${name}"`);

    if (!packageEntry.has(version))
        throw new Error(`Unknown version "${version}" for package "${name}"`);

    let archivePath = await fsUtils.createTemporaryFile(`${name}-${version}.tar.gz`);
    await fsUtils.packToFile(archivePath, packageEntry.get(version).path, { virtualPath: `/package` });

    return archivePath;

}

export async function getPackageHttpArchivePath(name, version) {

    let packageEntry = await getPackageEntry(name);

    if (!packageEntry)
        throw new Error(`Unknown package "${name}"`);

    if (!packageEntry.has(version))
        throw new Error(`Unknown version "${version}" for package "${name}"`);

    let serverUrl = await startPackageServer();
    let archiveUrl = `${serverUrl}/${name}/-/${name}-${version}.tgz`;

    return archiveUrl;

}

export async function startPackageServer() {

    if (startPackageServer.url)
        return startPackageServer.url;

    async function processPackageInfo(params, res) {

        if (!params)
            return false;

        let [, scope, localName ] = params;
        let name = scope ? `${scope}/${localName}` : localName;

        let packageEntry = await getPackageEntry(name);

        if (!packageEntry)
            return await processError(res, 404);

        let versions = Object.assign({}, ... Array.from(packageEntry.entries()).map(([ version, { packageJson } ]) => ({ [version]: packageJson })));
        res.writeHead(200, { [`Content-Type`]: `application/json` });
        res.end(JSON.stringify({ name, versions }));

        return true;

    }

    async function processPackageTarball(params, res) {

        if (!params)
            return false;

        let [, scope, localName, version ] = params;
        let name = scope ? `${scope}/${localName}` : localName;

        let packageEntry = await getPackageEntry(name);

        if (!packageEntry || !packageEntry.has(version))
            return await processError(res, 404);

        let path = packageEntry.get(version).path;
        res.writeHead(200, { [`Content-Type`]: `application/octet-stream`, [`Transfer-Encoding`]: `chunked` });

        let packStream = fsUtils.packToStream(path, { virtualPath: `/package` });
        packStream.pipe(res);

        return true;

    }

    async function processError(res, statusCode = 500) {

        res.writeHead(statusCode);
        res.end();

        return true;

    }

    return await new Promise((resolve, reject) => {

        let server = Http.createServer(async (req, res) => {

            if (await processPackageInfo(req.url.match(/^\/(?:(@[^\/]+)\/)?([^@\/][^\/]*)$/), res))
                return;

            if (await processPackageTarball(req.url.match(/^\/(?:(@[^\/]+)\/)?([^@\/][^\/]*)\/-\/\2-(.*)\.tgz$/), res))
                return;

            await processError(res);

        }).unref().listen(() => {

            let { port } = server.address();

            resolve(startPackageServer.url = `http://localhost:${port}`);

        });

    });

}

export function makeTemporaryEnv(config, fn) {

    if (typeof fn !== `function`)
        throw new Error(`Invalid test function (got ${typeof fn}) - you probably put the closing parenthesis of the "makeTemporaryEnv" utility at the wrong place`);

    return async function () {

        let path = await fsUtils.createTemporaryFolder();

        await fsUtils.writeFile(`${path}/.yarnrc`, JSON.stringify({ cachePath: null, mirrorPath: null, registryUrl: await startPackageServer() }));
        await fsUtils.writeFile(`${path}/package.json`, JSON.stringify(await superResolve(config)));

        await fn({ path, run: async (... spread) => {

            let exitCode = await cli.run(null, [ `--silent`, `--dir`, path, ... spread ]);

            if (exitCode !== 0) {
                throw new Error(`Execution stopped with exit code ${exitCode}`);
            } else {
                return 0;
            }

        } });

    };

}
